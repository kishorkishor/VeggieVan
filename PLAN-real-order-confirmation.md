# PLAN: Real order confirmation page

**Rank: 4 of 5.**

## Goal

The checkout redirects to `/checkout/success?order=<id>`, but
`app/checkout/success/page.tsx` is a fully static client component that **ignores the
`order` query param entirely**. It shows hard-coded copy ("We've emailed your
confirmation" — no email is ever sent) and no order number, items, or totals. For a demo
that prides itself on "checkout that creates real orders", the confirmation page is the
one screen that proves it — and it currently proves nothing.

After this plan: the success page is a server component that loads the real order (with
items) from Postgres, renders the order number, line items, subtotal/shipping/total, and
delivery address city, and keeps the confetti. If the order can't be found (bad id, DB
down, direct navigation), it degrades to a generic confirmation instead of erroring.

## Exact files to touch

| File | Change |
| --- | --- |
| `lib/orders/queries.ts` | Add `getOrderById(id)` returning `OrderWithItems \| null`. |
| `app/checkout/success/page.tsx` | Convert to an async server component; fetch + render the order. |
| `app/checkout/success/Confetti.tsx` | **New.** Client component holding the current `useEffect` confetti logic. |

## Step-by-step implementation order

### Step 1 — Query helper

In `lib/orders/queries.ts` (already `server-only` + imports `prisma`):

```ts
export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  if (!id) return null;
  try {
    return await prisma.order.findUnique({ where: { id }, include: { items: true } });
  } catch {
    return null; // DB unreachable → page falls back to generic confirmation
  }
}
```

The try/catch matters: unlike product queries there is no static fallback for orders, and
the success page must never 500 right after a customer paid.

### Step 2 — Split out the confetti

Create `app/checkout/success/Confetti.tsx` with `"use client"` at the top. Move the entire
`useEffect` + `canvas-confetti` block from the current page into it; it renders `null`.
Keep the exact confetti parameters (colors, three timed bursts).

### Step 3 — Rewrite the page as a server component

`app/checkout/success/page.tsx`:

- Remove `"use client"`. The component becomes:
  ```tsx
  export default async function SuccessPage({
    searchParams,
  }: {
    searchParams: Promise<{ order?: string }>;
  }) {
    const { order: orderId } = await searchParams;
    const order = orderId ? await getOrderById(orderId) : null;
    ...
  }
  ```
  **Next.js 15 makes `searchParams` a Promise** — it must be awaited. Typing it as a plain
  object is the classic mistake here; the build's typegen will reject it.
- Keep the existing layout (icon, heading, InfoCards, CTA buttons) but:
  - Render `<Confetti />` at the top.
  - The `motion.div` spring animation on the check icon requires framer-motion (client).
    Simplest correct fix: move the animated icon **into** `Confetti.tsx` (rename the
    client component `SuccessHero.tsx`, have it render the animated icon and fire
    confetti) or replace `motion.div` with a plain `div` + a CSS animation. Either is
    acceptable; do not import `framer-motion` in the server component.
  - When `order` is non-null, add an order summary card: order id, per-item rows
    (`name`, `qty`, `formatEUR(price * qty)` — `price` is the unit price in cents,
    see `prisma/schema.prisma` OrderItem comment), then subtotal / shipping / total via
    `formatEUR` from `@/lib/utils`, and "Delivering to {customerCity}".
  - Replace the false "Receipt on its way / We've emailed your confirmation" card copy
    with honest copy, e.g. title "Order recorded", desc referencing the order id — this
    app sends no email.
  - When `order` is null, render the current generic version (no summary card, no order
    number) — do NOT show an error state.

### Step 4 — Verify the redirect contract

`app/checkout/page.tsx` already pushes `/checkout/success?order=${res.id}`. No change
needed there, but confirm the param name stays `order` on both sides.

## Edge cases found while exploring (easy to miss)

- **`searchParams` is a `Promise` in Next 15** (this repo is on `next ^15.3.9`). Await it.
- **framer-motion and canvas-confetti cannot run in a server component** — both currently
  live in this page; both must end up behind a `"use client"` boundary.
- **Order IDs are guessable today** (`ord_<timestamp base36>`) — showing order details to
  anyone holding the URL is an enumeration risk *until* PLAN-secure-atomic-checkout lands
  (random ids). Sequence note: land that plan first (it is rank 1 anyway). The page shows
  no payment credentials either way; the exposed data is name-free (don't render
  `customerName`, `customerEmail`, or street address — city only).
- **DB-down after checkout**: `getOrderById` swallows the error so the customer still gets
  a confirmation screen; this mirrors how `listProducts` degrades.
- **Money fields are cents** (`Int`) — always format through `formatEUR`; never divide by
  100 inline.
- The page is automatically dynamic because it reads `searchParams` — do not add
  `export const dynamic` or `revalidate`.

## Acceptance criteria

1. `npm run lint && npm run typecheck && npm run build` pass (build without
   `DATABASE_URL` must still succeed — the page must not throw at build time).
2. With a DB: complete a checkout with two different products. The success page shows the
   real order id, both line items with correct quantities and euro amounts, and
   subtotal + shipping + total matching the admin orders drawer for the same order.
3. Confetti still fires and the check-icon animation still plays (client boundary works).
4. Visiting `/checkout/success` with no param, and with `?order=does-not-exist`, renders
   the generic confirmation — no error page, no empty summary card.
5. Stop the database and load a previously valid `?order=` URL: generic confirmation
   renders (no 500).
6. The rendered page contains no customer name, email, or street address.
