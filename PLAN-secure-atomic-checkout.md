# PLAN: Secure, atomic checkout (server-priced orders + transactional stock)

**Rank: 1 of 5 — do this first.**

## Goal

Today the server trusts everything the checkout client sends and mutates data in two
unrelated steps:

1. `placeOrderAction` (lib/orders/actions.ts) accepts client-supplied `price`, `name`,
   `subtotal`, `shipping`, and `total` and writes them straight to the DB. Anyone can call
   this server action with `price: 0` and create a free order.
2. `decrementStockAction` (lib/products/actions.ts) is a **public, un-authenticated server
   action** that decrements arbitrary product stock. Anyone can call it in a loop and zero
   out (or drive negative) the entire inventory without buying anything.
3. The two steps are not atomic — the checkout page calls them sequentially
   (app/checkout/page.tsx `onSubmit`), so a crash between them leaves an order with no
   stock movement, and there is no stock-availability check at all (out-of-stock items can
   be purchased freely).
4. Order IDs are `` `ord_${Date.now().toString(36)}` `` — two checkouts in the same
   millisecond collide on the primary key and the second order fails.

After this plan: the client sends only `{ productId, qty }` plus the customer address; the
server looks up real prices from the DB, computes shipping itself, verifies and decrements
stock, and creates the order — all inside one Prisma transaction with a collision-safe ID.
The public `decrementStockAction` is deleted.

## Exact files to touch

| File | Change |
| --- | --- |
| `lib/cart-math.ts` | **New.** Shared pure pricing functions (no `"use client"`, no `"use server"`). |
| `lib/stores.ts` | Re-export/delegate `cartTotals` to `lib/cart-math.ts` so client callers are untouched. |
| `lib/orders/actions.ts` | Rewrite `placeOrderAction` (new input shape, server pricing, transaction). |
| `lib/products/actions.ts` | Delete `decrementStockAction`; make `resetAllProductsAction` use one `$transaction`. |
| `app/checkout/page.tsx` | Send only ids/qtys + customer; remove `decrementStockAction` import/call. |
| `__tests__/lib/cartMath.test.ts` | **New.** Unit tests for the shared pricing function. |

## Step-by-step implementation order

### Step 1 — Extract shared pricing math

Create `lib/cart-math.ts`:

```ts
export const FREE_SHIPPING_AT = 5000; // cents (€50)
export const SHIPPING_FLAT = 399; // cents (€3.99)

export function shippingFor(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_AT || subtotal === 0 ? 0 : SHIPPING_FLAT;
}
```

**Do not** put `"use client"` or `"use server"` at the top of this file. It must be
importable from both `lib/stores.ts` (a `"use client"` module) and
`lib/orders/actions.ts` (a `"use server"` module).

In `lib/stores.ts`, replace the hard-coded constants inside `cartTotals` with imports from
`lib/cart-math.ts`. Keep the returned object shape **exactly** the same
(`{ subtotal, shipping, total, count, FREE_SHIPPING_AT }`) — `__tests__/lib/cartTotals.test.ts`
asserts on `FREE_SHIPPING_AT: 5000` and the shipping behavior, and `CartDrawer.tsx` +
`app/checkout/page.tsx` destructure these fields.

### Step 2 — Rewrite `placeOrderAction`

New input schema (customer part unchanged, items reduced, totals removed):

```ts
const placeSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    address: z.string().min(1),
    city: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().optional(),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive().max(999),
      })
    )
    .min(1)
    .max(100),
});
```

Implementation inside the action (after `safeParse`):

1. **Merge duplicate productIds** (a hostile payload can repeat an id to bypass later
   checks): build a `Map<string, number>` summing qtys, then work from that.
2. Open an **interactive transaction**: `await prisma.$transaction(async (tx) => { ... })`.
3. Inside the transaction:
   - `const products = await tx.product.findMany({ where: { id: { in: ids } } })`.
   - If `products.length !== ids.length`, throw `new Error("UNKNOWN_PRODUCT")`.
     (There is **no FK from OrderItem.productId to Product** in the schema — see
     prisma/schema.prisma — so without this check the DB would happily accept garbage ids.)
   - Compute `subtotal` from **DB prices** (`product.price * qty`), `shipping` via
     `shippingFor(subtotal)` from `lib/cart-math.ts`, `total = subtotal + shipping`.
   - Decrement stock with an availability guard, per item:
     ```ts
     const res = await tx.product.updateMany({
       where: { id: productId, stock: { gte: qty } },
       data: { stock: { decrement: qty } },
     });
     if (res.count === 0) throw new Error(`OUT_OF_STOCK:${productId}`);
     ```
     Use `updateMany`, not `update` — Prisma's `update` does not allow non-unique filters
     like `stock: { gte: qty }` in `where`. This is the standard conditional-decrement
     pattern and it makes overselling impossible even under concurrent checkouts.
   - Create the order with a collision-safe id:
     `` id: `ord_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}` ``
     (`crypto.randomUUID` is a Node 18+ global; no import needed). Item `name` and `price`
     come from the DB rows fetched above, **never** from client input.
   - Return the created order (and the computed `total`).
4. After the transaction succeeds, call `revalidatePath` for **both** the admin views
   (`/admin`, `/admin/orders`) and the storefront paths that `decrementStockAction` used to
   refresh (`/`, `/products`, and `revalidatePath("/products/[slug]", "page")`,
   `/admin/inventory`) — stock changed, so the storefront ISR pages must revalidate.
5. Error mapping in the `catch`: if `e.message` starts with `OUT_OF_STOCK`, return
   `{ ok: false, error: "One or more items are out of stock" }`; if `UNKNOWN_PRODUCT`,
   return `{ ok: false, error: "Invalid product in cart" }`; otherwise keep the existing
   generic message. Never leak raw error text to the client.
6. Return shape: extend to `{ ok: true; id: string; total: number }` so the UI could show
   the authoritative total. Keep `{ ok: false; error: string }` unchanged.

### Step 3 — Delete `decrementStockAction`

Remove the whole function from `lib/products/actions.ts`. Grep for usages first:
its only caller is `app/checkout/page.tsx`. While in this file, also fix
`resetAllProductsAction`: replace the sequential `for` loop of `await prisma.product.update`
with a single `await prisma.$transaction(PRODUCTS.map((seed) => prisma.product.update({...})))`.

### Step 4 — Update the checkout page

In `app/checkout/page.tsx` `onSubmit`:

- Remove the `decrementStockAction` import and call, and the `orderItems` mapping that
  reads names/prices from `PRODUCTS`.
- Call `placeOrderAction` with `items: items.map((i) => ({ productId: i.productId, qty: i.qty }))`
  and the same `customer` object as today. Do not send `subtotal`/`shipping`/`total`.
- Keep the existing error handling (`alert(res.error)`) and the redirect to
  `/checkout/success?order=${res.id}`.

### Step 5 — Tests

Create `__tests__/lib/cartMath.test.ts` covering `shippingFor`: `0 → 0`,
`4999 → 399`, `5000 → 0`, `9999 → 0`. Run the full suite.

## Edge cases found while exploring (easy to miss)

- **`lib/stores.ts` starts with `"use client"`** — the server action must NOT import
  `cartTotals` from there or the build breaks. That is the entire reason Step 1 exists.
- **Duplicate productIds in the payload**: without merging, `updateMany` would be called
  twice and each call individually passes the `gte` check for its own qty, but the order
  totals would still be right; merging keeps the stock guard honest for the combined qty.
- **No FK between OrderItem.productId and Product** — unknown ids must be rejected in
  application code.
- **Order-ID collision** under concurrent checkouts (`Date.now()`-based id) — fixed by
  UUID-derived id. Do not use `cuid()` from `@prisma/client` internals; `crypto.randomUUID()`
  is dependable and dependency-free.
- **`prisma.$transaction(async (tx) => ...)`** (interactive) is required, not the array
  form, because the stock check result decides whether order creation happens.
- **Revalidation set must include storefront paths** — the old stock-decrement action
  revalidated `/`, `/products`, `/products/[slug]`; if you forget these, ISR pages keep
  showing stale stock.
- The checkout page still *displays* totals computed from static `data/products.ts`
  (`cartTotals(items, PRODUCTS)`). That display-vs-DB drift is fixed separately by
  PLAN-live-catalog-data; this plan only makes the *charged* values authoritative.

## Acceptance criteria

1. `npm run lint && npm run typecheck && npm run test` all pass; the new
   `cartMath.test.ts` runs.
2. `grep -rn "decrementStockAction" app lib components` returns nothing.
3. Type-level check: `placeOrderAction`'s input type no longer contains `price`, `name`,
   `subtotal`, `shipping`, or `total` (inspect the schema in lib/orders/actions.ts).
4. With a DB running (`npm run db:push && npm run db:seed`, `npm run dev`): completing a
   checkout with 2×p01 creates an Order whose item price is 549 (from DB, verify in
   `npm run db:studio`), decrements p01 stock by 2, and lands on the success page.
5. Set a product's stock to 1 in the admin inventory, put qty 2 of it in the cart, and
   check out: the order is **rejected** with an out-of-stock error, no Order row is
   created, and stock remains 1 (transaction rolled back).
6. Two orders placed back-to-back both succeed with distinct ids.
