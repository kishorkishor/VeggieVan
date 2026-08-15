# Task 4 Report: Growth provider, storefront instrumentation, and treatment UIs

## Status

Implemented Task 4 on `feature/growth-engineering`. The root provider initializes after hydration without gating children, all public storefront events use the existing strict schema and fail-open transport, and control branches preserve the storefront's existing visible behavior. Nothing was pushed, deployed, or sent to an external service.

## TDD evidence

### RED

Created `__tests__/growth/provider.test.ts` and `__tests__/growth/instrumentation.test.ts` before either pure production module existed.

Command:

```text
npm.cmd test -- __tests__/growth/provider.test.ts __tests__/growth/instrumentation.test.ts --pool=threads --maxWorkers=1
```

Result: FAIL as expected. Both suites failed import resolution because `@/lib/growth/provider` and `@/lib/growth/instrumentation` did not exist. No tests collected, establishing that the required provider initialization and event-building behavior was absent.

### GREEN

Added the minimal pure provider initialization/context builder and storefront instrumentation helpers, then reran the same focused command.

Result: PASS — 2 files, 8/8 tests.

Behaviors proved in the cycle:

- every registered experiment receives a deterministic assignment;
- assignments persist under `rype-growth-assignments-v1` and reload unchanged;
- assignments that do not match the current anonymous session are replaced;
- disabled storage is fail-open;
- public events receive session ID, all active assignments, first-touch attribution, event ID, and timestamp;
- price-band boundaries are stable;
- product-view properties use only the strict allowlist;
- add-to-cart properties use the post-mutation cart state, including existing quantities;
- checkout start and validated step properties use current catalog/cart totals.

### Compiler regression cycle

The first integrated typecheck failed at `PDPClient.tsx` because the React 19 `useRef` overload required an explicit initial value. Inspection confirmed the new once-only product-view ref was the sole source. Initializing it with `undefined` was the only change; the immediate typecheck rerun passed.

## Implementation

- Added one root `GrowthProvider` inside the existing session boundary and outside the existing catalog/storefront content. Children render on the first pass; analytics initializes in an effect.
- The provider exposes `ready`, `variant`, `track`, and `expose`. It attaches the existing anonymous identity, persisted assignments, attribution, generated event ID, and ISO time to every event before parsing it through `publicGrowthEventSchema` and sending it through the existing transport.
- Exposure delivery is deduplicated at provider scope before using the existing fail-open exposure transport. `ExperimentExposure` requests exposure only after the relevant rendered section mounts and the provider is ready.
- PDP product views and checkout starts use refs to remain once-only under Strict Mode effect replay and rerenders.
- PDP and card add-to-cart handlers read Zustand immediately after the existing synchronous mutation, then calculate subtotal and quantity from the real resulting cart plus current catalog.
- Related-product control order remains unchanged. Treatment uses the existing deterministic `rankRelatedProducts` copy and labels card adds as `recommendation`.
- The cart's existing progress presentation and `Checkout` CTA remain unchanged for control. Treatment renders the concise free-delivery treatment and uses `Continue to secure checkout`.
- Checkout exposes the two relevant checkout experiments only for a non-empty cart. It emits address after successful validation, delivery when advancing, and payment immediately inside the validated submit callback.
- Checkout reassurance is treatment-only and contains concise delivery, no-surprise-fees, and freshness-guarantee copy.

## Verification

- Focused Task 4 tests:
  - Command: `npm.cmd test -- __tests__/growth/provider.test.ts __tests__/growth/instrumentation.test.ts --pool=threads --maxWorkers=1`
  - Result: PASS — 2 files, 8/8 tests.
- Typecheck:
  - Command: `npm.cmd run typecheck`
  - Result: PASS — exit code 0.
- Lint:
  - Command: `npm.cmd run lint`
  - Result: PASS — exit code 0.
- Full unit suite:
  - Command: `npm.cmd test -- --pool=threads --maxWorkers=1 --reporter=dot`
  - Result: PASS — 16 files, 129/129 tests, exit code 0.
- Production build:
  - Command: `npm.cmd run build`
  - Result: PASS — exit code 0; 52 static pages generated. Prisma logged the expected missing-`DATABASE_URL` validation messages while the catalog queries used their existing static fallback.
- Storefront E2E, first sandbox attempt:
  - Command: `npm.cmd run e2e -- e2e/storefront.spec.ts`
  - Result: BLOCKED by the execution sandbox: `browserType.launch: spawn EPERM`. The stuck server child processes were identified by their exact PIDs and stopped before retrying.
- Storefront E2E, permitted browser retry with a disposable process-only secret:
  - Command: `$env:AUTH_SECRET='test-only-rype-growth-secret-2026'; npm.cmd run e2e -- e2e/storefront.spec.ts`
  - Result: PASS — Chromium 1/1, 7.6 s test time, 13.8 s overall, exit code 0. The secret was not saved or committed. Growth endpoint persistence logged missing-`DATABASE_URL` errors, while fail-open tracking preserved the full shopper flow.

## Files

Created:

- `lib/growth/GrowthProvider.tsx`
- `lib/growth/provider.ts`
- `lib/growth/instrumentation.ts`
- `components/growth/ExperimentExposure.tsx`
- `components/growth/FreeShippingProgress.tsx`
- `components/growth/CheckoutReassurance.tsx`
- `__tests__/growth/provider.test.ts`
- `__tests__/growth/instrumentation.test.ts`
- `.superpowers/sdd/task-4-report.md`

Modified:

- `app/layout.tsx`
- `app/products/[slug]/PDPClient.tsx`
- `app/checkout/page.tsx`
- `components/layout/CartDrawer.tsx`
- `components/product/ProductCard.tsx`

## Self-review

- React review: all new hooks are unconditional; effect dependencies are complete; effect replay is guarded; no subscription cleanup is required; treatment-only components use semantic text/list markup and existing design tokens.
- Provider review: assignments are compared with deterministic server-compatible values before reuse; storage, initialization, schema, and transport failures cannot gate or interrupt shopping; exposure keys are deduplicated only after readiness.
- Event review: all event builders return the discriminated public input type; the provider performs runtime schema validation; no customer, form, query-string, product name, or other free-form data is added.
- Cart review: metrics use subtotal (the existing event convention) and quantity count from known catalog items after mutation, not a stale render snapshot.
- Experiment review: control preserves the original related array, original cart progress markup, original CTA copy, checkout markup, prices, shipping math, and static catalog fallback.
- Scope review: no dependency, database schema, API route, auth flow, unrelated component, deployment, or external service was changed.
- Diff hygiene: final `git diff --check` is recorded below before commit; Windows line-ending notices are expected and not whitespace errors.

## Concerns

No known implementation blockers. In an environment without `DATABASE_URL`, growth POSTs return fail-open failures and therefore are not persisted even though the static storefront and E2E path work. A configured database is required to verify stored events/exposures end to end; that prerequisite is outside Task 4 and was deliberately not added.

---

## Re-review fixes: actual-render exposure, payment timing, browser coverage, and accessibility

Addressed every item in `task-4-findings.md` after the user resolved `free_shipping_progress_v1` in favor of cart-only exposure.

### TDD RED evidence

Expanded `e2e/storefront.spec.ts` before changing production code. The new harness:

- derives deterministic all-control and all-treatment session IDs through the real `assignVariant` function;
- installs the matching persisted anonymous identity before hydration;
- can seed the persisted Zustand cart for direct checkout coverage;
- intercepts both growth endpoints and captures parsed request bodies, so behavior is deterministic without Postgres;
- leaves the original happy-path test intact.

Initial expanded command:

```text
$env:AUTH_SECRET='test-only-rype-growth-secret-2026'; npm.cmd run e2e -- e2e/storefront.spec.ts
```

Initial result: FAIL — 1 passed and 3 failed. This run directly proved checkout sent one forbidden `free_shipping_progress_v1` exposure. Two recommendation failures identified incorrect test fixture expectations (`Baby Leeks` is one of the four actual static-fallback results); those expectations were corrected before production changes and are not counted as product defects.

Corrected focused RED command:

```text
$env:AUTH_SECRET='test-only-rype-growth-secret-2026'; npm.cmd run e2e -- e2e/storefront.spec.ts --grep "treatment renders|checkout exposes"
```

Corrected result: FAIL — 2/2 tests failed for the intended missing behaviors:

- the treatment shipping surface had no element with the `progressbar` role or value attributes;
- checkout had already captured three completed-step events where only address and delivery were expected, demonstrating the payment event's premature placement.

The earlier checkout-only assertion also separately recorded the forbidden free-shipping exposure (`expected length 0`, received one treatment exposure), completing RED evidence for all three production defects.

### Minimal production fixes

- Removed `ExperimentExposure experiment="free_shipping_progress_v1"` from checkout. Both control and treatment free-shipping surfaces continue to expose from the cart drawer, and direct checkout now exposes only `checkout_reassurance_v1`.
- Moved payment step completion below the existing simulated-payment wait and directly before `placeOrderAction`. Address and delivery timing is unchanged.
- Added `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, and the calculated `aria-valuenow` to the visible treatment progress surface. The readable free-delivery text remains inside that surface.

### E2E behavior now covered

- exact control related-product ordering and treatment ranking;
- control cart markup/CTA versus treatment progress/secure-checkout CTA;
- control and treatment exposure delivery on their actual rendered surfaces;
- cart-only free-shipping exposure, including direct checkout with a pre-seeded cart;
- checkout reassurance absence in control and presence in treatment;
- one product view with `direct` placement;
- PDP, recommendation, and listing add-to-cart placement payloads, including resulting cart values and sizes;
- one checkout start despite checkout rerenders and step changes;
- no address completion after failed validation;
- address and delivery events only after advancement;
- payment completion at least 750 ms after payment submission begins, matching its placement after the 800 ms simulated phase;
- preserved original database-free storefront happy path.

### GREEN evidence and final verification

After the production changes, the first full run passed the happy path, control wiring, and treatment/accessibility tests. The checkout event timestamps showed payment moved approximately 817 ms later, but the first test checkpoint awaited Playwright's async submit click and therefore started too late. The assertion was corrected to compare the captured event's `occurredAt` against the submission start time; production code did not change for that test-only correction.

Isolated checkout GREEN:

```text
$env:AUTH_SECRET='test-only-rype-growth-secret-2026'; npm.cmd run e2e -- e2e/storefront.spec.ts --grep "checkout exposes"
```

Result: PASS — 1/1 test, exit code 0.

Final full storefront E2E:

```text
$env:AUTH_SECRET='test-only-rype-growth-secret-2026'; npm.cmd run e2e -- e2e/storefront.spec.ts
```

Result: PASS — 4/4 Chromium tests, 22.2 s overall, exit code 0. The disposable Auth.js secret existed only in that process. The original happy path still logged expected missing-`DATABASE_URL` persistence failures and passed; the deterministic growth tests intercepted analytics requests and required no database.

Other final verification:

- Focused unit: `npm.cmd test -- __tests__/growth/provider.test.ts __tests__/growth/instrumentation.test.ts --pool=threads --maxWorkers=1` — PASS, 2 files and 8/8 tests.
- Typecheck: `npm.cmd run typecheck` — PASS, exit code 0.
- Lint: `npm.cmd run lint` — PASS, exit code 0.
- Full unit: `npm.cmd test -- --pool=threads --maxWorkers=1 --reporter=dot` — PASS, 16 files and 129/129 tests.
- Production build: `npm.cmd run build` — PASS, exit code 0 and 52 static pages generated through the existing catalog fallback.

### Re-review self-review

- Exposure scope now follows the user-approved actual-render rule. A fresh checkout provider cannot emit free-shipping exposure; the cart emits one for either assigned variant only when its progress surface renders.
- Payment completion is after validation and the simulated payment phase, immediately adjacent to and before the existing order action.
- Request interception applies only to growth endpoints; it does not hide the checkout server action's expected database-free failure or alter storefront state transitions.
- Deterministic session IDs satisfy the existing anonymous identity format and assignments are still computed by production code rather than hard-coded in tests.
- The control assertions verify original visible behavior, while treatment assertions cover only the three scoped experiment changes.
- Progress semantics expose the same rounded percentage already visible in the treatment UI and retain human-readable text.

### Re-review concerns

No new implementation concerns or blockers. As before, database-free runs cannot persist growth events or complete an order, but analytics interception verifies client wiring and the existing fail-open/static storefront behavior remains intact.
