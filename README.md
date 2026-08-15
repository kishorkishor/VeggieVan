# VeggieVan

> Bringing Fresh Vegetables Home Every Morning.

A pre-order vegetable storefront for Dhaka, built as the website component of the
VeggieVan business plan (MGT368 Entrepreneurship, Section 14, Group E).

Customers order between **8:00 PM and 11:59 PM**. Produce is sourced overnight from
farmers and wholesalers at Karwan Bazar against confirmed orders only, inspected,
graded, sorted, weighed, and packed — then delivered door to door from **7:00 AM**
the next morning across **Uttara, Mirpur, Bashundhara, Khilgaon, and Dhanmondi**.

> [!IMPORTANT]
> **This is a demonstration build, not a live shop.** No payment is taken, no real
> order is placed, and no vegetables are delivered. Prices match the business plan
> exactly (see [Prices](#prices)), but connecting real bKash or Nagad payments would
> require approved merchant accounts and reviewed customer-facing policies.

## What works

- **Catalog** — 10 vegetables and the 2 baskets, with bilingual names (`Bottle Gourd (Lau)`), the exact quantity each is sold in, filtering by category, quantity, and price, fuzzy search, and product detail pages.
- **Cart** — persistent basket, wishlist, and side-by-side comparison.
- **Checkout** — three steps (address → delivery → payment) using Bangladeshi fields: name, mobile number, one of the five delivery areas, and street address. Email is optional, because most customers here order without one.
- **Payment options** — cash on delivery, bKash, and Nagad. COD is offered but never forced, matching how over 90% of Bangladeshi e-commerce orders are actually paid.
- **Order confirmation** — a receipt screen naming the delivery area and the 7:00 AM window.
- **Admin** — dashboard, orders, inventory, and users. Requires a database (below).

Runs with **no database at all**: every catalog query falls back to `data/products.ts`,
and checkout completes as a server-priced demo order.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Nothing else is required for the storefront.

### Optional: database-backed mode

Only needed for the admin screens and persisted orders.

```bash
npx auth secret
npm run db:push
npm run db:seed
```

Set `DATABASE_URL` to a PostgreSQL instance in `.env.local` first. Seeded logins are
`admin@veggievan.local` / `admin123` (full access) and `staff@veggievan.local` /
`staff123` (orders only).

## Prices

Every price and quantity below is taken directly from the business plan's
"Individual Vegetable Pricing" table (§4.B). Each basket's five member prices sum to
exactly the ৳335 combined figure the plan prints, and
`__tests__/data/baskets.test.ts` asserts that, so the site can never silently drift
from the report.

| Vegetable | Quantity | Price | Basket |
| --- | --- | ---: | --- |
| Potato (Alu) | 1 kg | ৳45 | Everyday Essentials |
| Local Onion (Peyaj) | 1 kg | ৳70 | Everyday Essentials |
| Red Tomato | 500 g | ৳45 | Everyday Essentials |
| Imported Garlic (Roshun) | 500 g | ৳125 | Everyday Essentials |
| Green Chilli (Kacha Morich) | 250 g | ৳50 | Everyday Essentials |
| Bottle Gourd (Lau) | 1 piece | ৳55 | Family Fresh |
| Brinjal (Begun) | 800 g | ৳85 | Family Fresh |
| Carrot (Gajor) | 500 g | ৳70 | Family Fresh |
| Cucumber (Shosha) | 500 g | ৳50 | Family Fresh |
| Pointed Gourd (Potol) | 500 g | ৳75 | Family Fresh |

| Basket | Bought separately | Basket price | Saving |
| --- | ---: | ---: | ---: |
| Everyday Essentials | ৳335 | ৳299 | ৳36 (10.7%) |
| Family Fresh | ৳335 | ৳300 | ৳35 (10.4%) |

Delivery is a flat **৳40 per order**, charged separately from the product or basket
price. There is no free-delivery threshold and no minimum order. Money is stored as
integer paisa throughout (1 BDT = 100 paisa) to avoid floating-point drift.

## Decisions taken where the plan was silent or contradictory

| Item | Resolution |
| --- | --- |
| §6.B still opens "pre-order and **subscription**-based" | Stale wording. Subscriptions are cancelled and its own numbered service list no longer includes them |
| Per-customer delivery window | Plan gives a 7:00 AM start but no end. Shown as indicative only |
| Minimum order | Not stated. None enforced |

Nothing on the site claims organic status, certification, a named farm, a customer
count, or a testimonial, because the business plan supports none of those.

## Still outstanding

- **Logo** — the header shows a wordmark and a placeholder glyph. Drop the real file at `public/logo.svg` and follow the comment in `components/ui/Logo.tsx`.
- **Contact details** — no business phone, WhatsApp, email, or social links yet. The founders' personal numbers and university emails from §1.B are deliberately **not** published.
- **B2B ordering** — listed as a revenue stream in the plan, not built.
- **Customer support hours** — the plan promises support 7:00 AM to 12:00 midnight; there is no contact channel wired up to honour it.
- **Policies** — delivery, refund, complaint, and privacy pages are placeholder links.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Prisma + PostgreSQL · Auth.js v5 · Zustand · Zod · Vitest · Playwright.

Product illustrations in `public/product-images/veggievan-catalog` are hand-authored
SVG generated to one shared visual language — no photography, no external assets, and
no licensing to clear.

## Checks

```bash
npm run typecheck && npm run lint && npm test && npm run e2e
```

The admin end-to-end tests skip automatically unless `DATABASE_URL` is set, since
admin sign-in reads users through Prisma and has no static fallback.

## Credit

Built on [rype](https://github.com/deepakpk-dev/rype) by deepakpk-dev, MIT licensed.
The storefront, cart, checkout, and admin scaffolding come from that project; the
catalog, branding, currency, delivery model, Bangladeshi checkout, and illustrations
are VeggieVan's.
