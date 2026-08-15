# PLAN: Test coverage for server actions + resilient CI E2E

**Rank: 3 of 5.**

## Goal

All 33 existing unit tests cover client-side Zustand stores and `cartTotals`
(`__tests__/stores/*`, `__tests__/lib/cartTotals.test.ts`). The security-critical code —
server actions with RBAC guards and Zod validation in `lib/orders/actions.ts` and
`lib/products/actions.ts` — has **zero tests**. A regression that removed the
`role !== "admin"` check on `removeOrderAction` or `updateProductAction` would ship green.

Separately, the single Playwright spec (`e2e/admin.spec.ts`) logs into the admin, which
requires `secrets.DATABASE_URL` / `secrets.AUTH_SECRET` in CI (`.github/workflows/ci.yml`).
On forks and PRs from outside contributors those secrets are empty, the server starts with
no DB, and E2E fails for reasons unrelated to the change.

Deliverables: unit tests for every server action's auth/validation behavior with mocked
Prisma + auth; a DB-independent storefront E2E spec; CI that skips DB-dependent E2E when
secrets are absent instead of failing.

## Exact files to touch

| File | Change |
| --- | --- |
| `__tests__/lib/orderActions.test.ts` | **New.** Tests for place/setStatus/remove order actions. |
| `__tests__/lib/productActions.test.ts` | **New.** Tests for update/reset product actions. |
| `__tests__/mocks/server-only.ts` | **New.** Empty module (`export {}`) to stub `server-only`. |
| `vitest.config.ts` | Alias `server-only` → the stub; keep the existing `@` alias. |
| `e2e/storefront.spec.ts` | **New.** DB-free cart/search flow. |
| `.github/workflows/ci.yml` | Gate DB-dependent E2E on secret presence; always run storefront E2E. |

## Step-by-step implementation order

### Step 1 — Make server modules importable under Vitest

`lib/orders/queries.ts`, `lib/products/queries.ts`, and `lib/admin-users.ts` begin with
`import "server-only"`, which **throws at import time outside a React Server Components
bundler**. The action modules import `@/auth` → `@/lib/admin-users` → `server-only`.
Without a stub, every test file that touches an action fails on import.

- Create `__tests__/mocks/server-only.ts` containing exactly `export {};`
- In `vitest.config.ts` add to `resolve.alias`:
  ```ts
  alias: {
    "@": path.resolve(__dirname, "."),
    "server-only": path.resolve(__dirname, "__tests__/mocks/server-only.ts"),
  },
  ```
  Note the existing alias is an object — extend it, don't replace the `@` entry.

### Step 2 — Order action tests (`__tests__/lib/orderActions.test.ts`)

Mock the two dependency modules **before** importing the actions (Vitest hoists `vi.mock`):

```ts
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    order: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    product: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { placeOrderAction, setOrderStatusAction, removeOrderAction } from "@/lib/orders/actions";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
```

`vi.mock("next/cache")` is mandatory — `revalidatePath` throws outside a Next request
scope ("static generation store missing"), so unmocked it fails every happy-path test.

Cases (adapt the `placeOrderAction` set to whichever input shape is live — if
PLAN-secure-atomic-checkout has landed, items are `{productId, qty}` and you should mock
`$transaction` to invoke its callback with a `tx` stub; if not, use the legacy payload):

- `placeOrderAction`: rejects empty items array; rejects invalid email; rejects
  non-integer/negative qty; returns `{ ok: false }` (not a throw) when prisma rejects.
- `setOrderStatusAction`: returns `Unauthorized` when `auth` resolves `null`; returns
  `Unauthorized` when session has no `role`; rejects a status outside the enum
  (e.g. `"refunded"`) **even when authed**; succeeds for role `"staff"` (staff may update
  statuses — that asymmetry vs. delete is intentional, lock it in with a test).
- `removeOrderAction`: returns `Admin only` for `staff` role and for `null` session;
  calls `prisma.order.delete` for `admin`.
- Assert the mocked `prisma` functions were **not called** on every rejection path — a
  guard that runs after the DB call is a broken guard.

Use `beforeEach(() => vi.clearAllMocks())` and type the auth mock casts as
`vi.mocked(auth)` with `mockResolvedValue({ user: { role: "staff" } } as never)` — `auth`
has a complex overloaded type; `as never`/`as any` on the resolved value is acceptable here.

### Step 3 — Product action tests (`__tests__/lib/productActions.test.ts`)

Same mocking recipe. Cases:

- `updateProductAction`: `Admin only` for staff/anonymous; rejects an **empty patch**
  (`patch: {}` — the schema has `.refine((p) => Object.keys(p).length > 0)`, cover it);
  rejects negative stock/price; passes the patch through to `prisma.product.update` for
  admin.
- `resetProductAction`: `Unknown product` for an id not in the seed (e.g. `"nope"`);
  resets known ids (assert `update` called with seed values for `"p01"`, including
  `featured: seed.featured ?? false` — seed `featured` is optional).
- `resetAllProductsAction`: admin-gated; returns `count` equal to the seed length.

### Step 4 — DB-free storefront E2E (`e2e/storefront.spec.ts`)

Flow (works against the static-fallback catalog, no login, no DB):

1. `page.goto("/products")`, click the first product card link, land on a PDP
   (`await expect(page).toHaveURL(/\/products\/.+/)`).
2. Click add-to-cart; assert the cart drawer opens (it auto-opens — `add()` in
   `lib/stores.ts` sets `drawerOpen: true`) and shows 1 line item.
3. Increment qty; assert the subtotal text changes.
4. Navigate to `/checkout`; assert the address step renders (`h1` "Checkout").
   Do **not** submit — order placement needs the DB.

Keep selectors role/text-based (`getByRole`) to match the existing spec's style.

### Step 5 — CI gating

In `.github/workflows/ci.yml`, secrets can't be read in `if:` directly; hoist to env:

```yaml
      - name: Check for E2E secrets
        id: e2e-secrets
        run: echo "has=${{ secrets.DATABASE_URL != '' && secrets.AUTH_SECRET != '' }}" >> "$GITHUB_OUTPUT"
```

- Server start + `wait-on` + a new "Run storefront E2E" step
  (`npx playwright test e2e/storefront.spec.ts`) run unconditionally, with
  `AUTH_SECRET: ci-dummy-secret-for-build-only-do-not-use` as fallback when the secret is
  empty (the server needs *an* AUTH_SECRET to boot; storefront pages don't need real auth).
- The existing "Run E2E tests" step becomes "Run admin E2E"
  (`npx playwright test e2e/admin.spec.ts`) with
  `if: steps.e2e-secrets.outputs.has == 'true'`.

## Edge cases found while exploring (easy to miss)

- **`server-only` throws on import in Vitest** — Step 1 is a hard prerequisite; without
  it the error is a confusing "This module cannot be imported from a Client Component
  module" at test collection time.
- **`revalidatePath` throws outside Next** — must be mocked; failures otherwise appear
  only on *success* paths, which is misleading.
- **`vi.mock` factories are hoisted above imports** — do not reference top-level variables
  inside the factory (Vitest throws "Cannot access before initialization"); define mock
  fns inline in the factory and retrieve them afterwards via the imported module.
- **`"use server"` / `"use client"` directives are inert strings in Vitest** — importing
  the action modules directly is fine; no Next runtime needed.
- **The staff-can-set-status asymmetry** (`setOrderStatusAction` requires any role,
  `removeOrderAction` requires admin) is intentional per README ("staff: Orders only") —
  the tests must encode it, not "fix" it.
- **Playwright config `reuseExistingServer: true`** with a CI-started background server —
  the new spec inherits this; don't add a second `webServer` entry.
- **Existing e2e retries are 2 in CI** — a flaky drawer animation can hide behind
  retries; prefer `await expect(...).toBeVisible()` auto-waiting over `waitForTimeout`.

## Acceptance criteria

1. `npm run test` passes locally **without** `DATABASE_URL` set; total test count
   increases from 33 to ≥ 50.
2. Deleting the `role !== "admin"` guard line in `removeOrderAction` makes at least one
   test fail (spot-check this mutation manually, then restore).
3. `npx playwright test e2e/storefront.spec.ts` passes locally against `npm run dev`
   with no DB and no login.
4. CI on a branch **with** repo secrets runs both E2E steps; the workflow file contains
   the `e2e-secrets` gate and the storefront step has no `if:` condition on secrets.
5. `npm run lint && npm run typecheck` pass (new test files are lint-clean).
