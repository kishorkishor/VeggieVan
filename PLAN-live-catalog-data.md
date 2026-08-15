# PLAN: Live catalog data in cart, checkout, search, wishlist, and compare

**Rank: 2 of 5.**

## Goal

The storefront is split-brained about where products live:

- **DB-backed (correct):** home page, `/products` list, product detail pages, admin
  inventory — all read via `lib/products/queries.ts`, which queries Prisma and falls back
  to the static seed when the DB is down.
- **Static-file-backed (stale):** `components/layout/CartDrawer.tsx`,
  `app/checkout/page.tsx`, `components/layout/SearchCommand.tsx`,
  `components/layout/CompareTray.tsx`, `app/wishlist/page.tsx`, `app/compare/page.tsx` —
  all import `PRODUCTS` from `data/products.ts` directly.

Consequences a demo visitor can see today:

1. An admin edits a price in `/admin/inventory` → the PDP shows the new price, but the
   cart drawer, checkout summary, search results, compare table, and wishlist still show
   the old seed price. (After PLAN-secure-atomic-checkout the *charged* amount is right,
   which makes the displayed drift even more visible.)
2. Cart/checkout show the original **Unsplash** images from `data/products.ts`, while PLP
   and PDP show the local SVGs applied by `presentProduct()`
   (`lib/products/presentation.ts` overrides `images` to `/product-images/rype-catalog/…`).
   The same product has different photos in the cart than on its own page.
3. There is **zero out-of-stock handling anywhere in the storefront UI** (verified:
   no component references `stock`). Sold-out items are freely addable.

Fix: fetch presented products once in the root layout (server), share them with client
components through a React context (`CatalogProvider`), and remove every storefront import
of `PRODUCTS` outside of `lib/products/*` and `prisma/seed.ts`. Add basic sold-out UX.

## Exact files to touch

| File | Change |
| --- | --- |
| `lib/catalog-context.tsx` | **New.** `"use client"` context + `CatalogProvider` + `useCatalog()` hook. |
| `app/layout.tsx` | Await `listProducts()` and wrap the tree in `CatalogProvider`. |
| `components/layout/CartDrawer.tsx` | Use `useCatalog()` instead of `PRODUCTS`; cap qty at stock. |
| `components/layout/SearchCommand.tsx` | Build Fuse index from `useCatalog()`. |
| `components/layout/CompareTray.tsx` | Use `useCatalog()`. |
| `app/checkout/page.tsx` | Use `useCatalog()` for the summary/totals display. |
| `app/wishlist/page.tsx` | Use `useCatalog()`. |
| `app/compare/page.tsx` | Use `useCatalog()`. |
| `components/product/ProductCard.tsx` | Show a “Sold out” state and disable add-to-cart when `stock <= 0`. |
| `app/products/[slug]/PDPClient.tsx` | Disable add-to-cart when `stock <= 0`. |
| `lib/products/queries.ts` | Add try/catch fallback to `lowStockCount` (currently the only query without one). |

## Step-by-step implementation order

### Step 1 — Catalog context

Create `lib/catalog-context.tsx`:

```tsx
"use client";
import { createContext, useContext } from "react";
import type { ProductRow } from "@/lib/products/queries";

const CatalogContext = createContext<ProductRow[]>([]);

export function CatalogProvider({
  products,
  children,
}: {
  products: ProductRow[];
  children: React.ReactNode;
}) {
  return <CatalogContext.Provider value={products}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): ProductRow[] {
  return useContext(CatalogContext);
}
```

Important: `ProductRow` is exported from `lib/products/queries.ts`, which begins with
`import "server-only"`. Importing a **type** from it in a client file is safe (types are
erased at build time) — several client files already do exactly this
(`app/products/ProductsClient.tsx`, `app/admin/inventory/InventoryClient.tsx`). Do NOT
import any *value* (like `listProducts`) from that module in client code.

### Step 2 — Provide it from the root layout

`app/layout.tsx` is a server component. Make the default export `async`, call
`const products = await listProducts()` (from `@/lib/products/queries`), and wrap the
existing body content (which includes `Header`, `CartDrawer`, `CompareTray`, etc.) in
`<CatalogProvider products={products}>…</CatalogProvider>`. Place the provider **inside**
the existing `SessionProviderWrapper`/body structure without reordering anything else.

`listProducts()` already falls back to the static seed when the DB is unreachable
(see the try/catch in lib/products/queries.ts), so this cannot break DB-less dev.

### Step 3 — Migrate consumers

In each of `CartDrawer.tsx`, `SearchCommand.tsx`, `CompareTray.tsx`,
`app/checkout/page.tsx`, `app/wishlist/page.tsx`, `app/compare/page.tsx`:

- Delete `import { PRODUCTS } from "@/data/products"` and replace usage with
  `const products = useCatalog()`.
- These are all already `"use client"` components (verify the directive is present at the
  top of each — the two pages `wishlist` and `compare` are client pages).
- `cartTotals(items, PRODUCTS)` becomes `cartTotals(items, products)`. The `cartTotals`
  signature in `lib/stores.ts` takes `Product[]` from `data/products.ts`; loosen it to
  a structural type so both shapes fit:
  `export function cartTotals(items: CartItem[], products: { id: string; price: number }[])`.
  The function only reads `id` and `price` (verify — it does). The existing test
  `__tests__/lib/cartTotals.test.ts` casts fakes through `unknown` so it keeps compiling.
- `SearchCommand.tsx` memoizes the Fuse index with `useMemo(...)` — keep the memo but add
  `products` to its dependency array, and replace the `PRODUCTS.slice(0, 6)` empty-query
  fallback with `products.slice(0, 6)`.
- `Filters.tsx` imports `CATEGORIES, ORIGINS` from `data/products` — that is fine, leave
  it (they are static taxonomies, not per-product data). Same for `CATEGORIES` in
  `app/page.tsx`.

### Step 4 — Sold-out UX

- `ProductCard.tsx`: when `product.stock <= 0`, render a "Sold out" badge and disable the
  add-to-cart button (`disabled` + `aria-disabled` + muted styles).
- `PDPClient.tsx`: same for its add-to-cart button.
- `CartDrawer.tsx` `QtyStepper`: disable the increment button when
  `item.qty >= p.stock` so users can't queue more than available (server still enforces —
  this is purely UX; PLAN-secure-atomic-checkout is the enforcement).

### Step 5 — `lowStockCount` fallback

In `lib/products/queries.ts`, wrap the `prisma.product.count` in try/catch and return the
static count on failure:
`return PRODUCTS.filter((p) => p.stock <= threshold).length;`
Every other query in the file has this fallback; this one crashes the admin dashboard
(`app/admin/page.tsx`) when the DB is down.

## Edge cases found while exploring (easy to miss)

- **The images actually differ today**: static `PRODUCTS.images` are Unsplash URLs while
  presented rows use local SVGs. After migration, cart/search/compare images switch to the
  local SVGs — that is the *desired* consistency. Don't remove the Unsplash
  `remotePatterns` from `next.config.ts` anyway (the raw data still references them and
  `presentHomepageProduct` uses local JPGs; keeping patterns is harmless).
- **`ProductRow` contains `Date` fields** (`createdAt`/`updatedAt`). Passing them from a
  server component to a client provider is supported by RSC serialization — do not
  `JSON.stringify` the products.
- **Cart items whose product no longer exists**: `cartTotals` already skips unmatched ids
  (`if (!p) continue`), and `CartDrawer` looks up `p` per item — it must keep its existing
  null-check (`PRODUCTS.find(...)` result is checked at line ~87). Checkout's summary uses
  a non-null assertion (`PRODUCTS.find(...)!`) — replace those `!` with a filter step
  (`items.filter((i) => products.some((p) => p.id === i.productId))`) so a stale
  localStorage cart can't crash the page.
- **Root layout becomes dynamic-ish**: `listProducts()` runs per request wherever the
  layout renders. That is already the cost profile of the home page; acceptable for this
  app. Do not add `export const dynamic = "force-dynamic"` to the layout.
- **Fuse.js key set**: the current index searches over static fields; presented products
  have replaced `tagline`/`description` for three bundles (see `PRODUCT_COPY` in
  presentation.ts) — search results will change slightly for those. Expected, not a bug.

## Acceptance criteria

1. `grep -rn 'from "@/data/products"' app components` shows only type imports and the
   `CATEGORIES`/`ORIGINS` taxonomy imports (`app/page.tsx`, `components/product/Filters.tsx`) —
   no `PRODUCTS` value import remains in `app/` or `components/`.
2. `npm run lint && npm run typecheck && npm run test && npm run build` pass. The build
   must succeed **without** `DATABASE_URL` set (static fallback path).
3. With a DB: change a product's price in `/admin/inventory`, then open the storefront —
   the cart drawer line total, checkout summary, search result, wishlist, and compare
   table all show the new price after reload.
4. Set a product's stock to 0 in the admin: its product card and PDP show "Sold out" with
   a disabled add button; a product already in the cart cannot have qty incremented past
   stock.
5. With the dev server running and no DB, the site still renders products everywhere
   (fallback), and the admin dashboard renders without crashing (lowStockCount fallback).
6. Manually corrupt localStorage (`rype-cart`) to contain a fake productId and open
   `/checkout` — the page renders (no crash from the removed `!` assertions).
