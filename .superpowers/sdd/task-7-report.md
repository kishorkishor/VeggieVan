# Task 7 Report: Admin-only growth dashboard

## Status

Implemented the admin-only `/admin/growth` dashboard on `feature/growth-engineering` with middleware, sidebar, and server-query authorization; recruiter-readable funnel, acquisition, and experiment evidence; explicit demo, empty, database-error, and limitations states; focused render/permission coverage; and an extended admin Playwright spec.

## User story and data flow

An authenticated admin selects Growth in the admin sidebar, Auth.js permits the route, the server page calls the existing admin-guarded 30-day query, and the result is rendered as funnel, acquisition, and registry-driven experiment evidence. Staff are redirected to `/admin?denied=1`; anonymous users are returned to Auth.js sign-in. If the analytics query fails, the server page renders a complete zero-safe dashboard plus a database warning instead of exposing database details.

## Files

- `auth.config.ts`
  - Added `isAdminOnlyPath()` and `adminPathDecision()` as pure, exported authorization decisions.
  - Added `/admin/growth` and descendants to the admin-only path set.
  - Maps anonymous access to Auth.js sign-in, staff access to the existing denied redirect, and admin access to allow.
- `components/admin/AdminSidebar.tsx`
  - Added the Growth navigation item with `TrendingUp`, visible only to admins.
- `lib/growth/queries.ts`
  - Added `emptyGrowthDashboardData()` using the existing analytics calculators so database failures still render five zero-safe stages and all registry experiments.
- `app/admin/growth/page.tsx`
  - Added a force-dynamic server page that calls `getGrowthDashboardData()`.
  - Preserves defense in depth by calling `notFound()` for the existing `Admin only` query error.
  - Converts other query failures into the required safe dashboard warning.
- `app/admin/growth/GrowthDashboard.tsx`
  - Added the 30-day header and conditional `Seeded demo data` badge.
  - Added five funnel cards with session, previous-stage, and overall rates.
  - Added acquisition source/campaign table and explicit empty state.
  - Added one experiment card per query result with exposures, conversions, rates, treatment-minus-control absolute lift, allocation balance, 95% Wilson intervals, primary metric labels, and evidence qualification.
  - Renders the exact small-sample copy via `\u2014`: `Insufficient evidence \u2014 directional only`.
  - Added limitations for anonymous/repeated sessions, first-touch scope, synthetic data, and sample uncertainty.
  - Does not render winner or loser claims.
- `__tests__/growth/permissions.test.ts`
  - Covers admin-only route and descendant matching plus anonymous, staff, and admin decisions.
- `__tests__/growth/dashboard.test.ts`
  - Covers zero-safe fallback calculation and static rendering of all dashboard sections, meaningful metrics, exact small-sample copy, demo state, empty acquisition, database error, and absence of winner/loser text.
- `vitest.config.ts`
  - Enabled the installed Vite OXC automatic JSX transform so TSX components can be rendered by Vitest.
- `e2e/admin.spec.ts`
  - Extracted reusable admin login setup.
  - Retained the orders drawer path as its own test.
  - Added a separate Growth path covering heading, demo badge, all five funnel stages, all three human-readable experiment names, and either documented evidence qualification.

## TDD evidence

### Authorization RED

Command:

```text
npm.cmd test -- __tests__/growth/permissions.test.ts
```

Result before production changes: exit 1; 1 file failed; 3/3 tests failed with `isAdminOnlyPath is not a function` and `adminPathDecision is not a function`. This was the expected missing-feature failure.

### Authorization GREEN

Same command after the minimal authorization implementation: exit 0; 1 file passed; 3/3 tests passed.

### Dashboard RED

Command:

```text
npm.cmd test -- __tests__/growth/dashboard.test.ts
```

Result before the dashboard implementation: exit 1; Vitest failed to resolve `@/app/admin/growth/GrowthDashboard`, the expected missing-feature boundary.

### Dashboard GREEN

After implementation, the first two attempts exposed test-harness issues rather than failed product assertions: Vite OXC preserved JSX, and the runtime query import needed the existing auth/database modules mocked. The harness was corrected with OXC automatic JSX and module mocks. The unchanged behavior assertions then passed: exit 0; 1 file passed; 3/3 tests passed.

### Final focused GREEN

Fresh final runs after review:

```text
npm.cmd test -- __tests__/growth/permissions.test.ts
```

Exit 0; 1 file passed; 3/3 tests passed.

```text
npm.cmd test -- __tests__/growth/dashboard.test.ts
```

Exit 0; 1 file passed; 3/3 tests passed.

## Verification

- `npm.cmd test`
  - Final run: exit 0; 21 files passed; 159/159 tests passed.
- `npm.cmd run typecheck`
  - Final run: exit 0; no TypeScript errors.
- `npm.cmd run lint`
  - Final run: exit 0; no ESLint findings.
- `$env:AUTH_SECRET='task7-local-build-verification-only'; npm.cmd run build`
  - Final run: exit 0; compiled successfully and generated 52/52 pages.
  - `/admin/growth` is present as a dynamic server-rendered route.
  - The build emitted the existing missing-`DATABASE_URL` Prisma prerender messages and `tailwind.config.ts` module-type warning; neither failed the build.
- `.\node_modules\.bin\playwright.cmd test admin.spec.ts --list`
  - Exit 0; discovered both admin tests.
- `git diff --check`
  - Exit 0; no whitespace errors.
- Mojibake and claim scans
  - No `â`/`Â` corruption remains in the Task 7 UI/tests.
  - No `winner` or `loser` text exists in the growth dashboard source.

### Admin E2E execution

The database-backed Playwright tests were not run and are not reported as passing. The repository has only `.env.local.example`, whose database value is a non-loopback example; no configured local `DATABASE_URL` or auth secret is available. External database access is prohibited. In addition, current `prisma/seed.ts` does not yet create growth demo rows, so the `Seeded demo data` assertion depends on Task 8 as planned. A disposable local `AUTH_SECRET` can cover auth when a local seeded database becomes available, but it cannot supply the missing database and demo rows.

## Independent review

Independent review found no Critical or Minor issues and one Important cross-task E2E issue: the first E2E version hard-coded the insufficient-evidence copy, while Task 8's planned sample size can legitimately produce `Descriptive comparison only`. The E2E now accepts either documented evidence qualification; the unit render test still requires the exact insufficient-evidence copy for a sub-100 sample. The reviewer otherwise confirmed the auth mapping/server guard, exact copy, no winner/loser claims, empty/database states, and admin-only navigation.

## Self-review

- Confirmed `/admin/growth` and descendants use the same pure role decision as the Auth.js callback.
- Confirmed staff redirect and anonymous sign-in decisions are distinct and tested.
- Confirmed the server query remains the data-access authorization boundary and rejects non-admin sessions before Prisma reads through the existing query tests.
- Confirmed query failures render the required safe message and complete zero-safe data rather than database details.
- Confirmed all five funnel stages and all three registry experiments render even with zero data.
- Confirmed every experiment renders exposures, conversions, rate, lift, allocation, Wilson interval, and a descriptive evidence state.
- Confirmed the exact small-sample copy renders as a true em dash at runtime.
- Confirmed the demo badge depends only on the query's explicit `includesDemo` flag.
- Confirmed limitations cover repeated sessions, attribution scope, demo records, and sample size.
- Confirmed no external service was accessed and nothing was pushed or deployed.

## Concerns

- The live admin E2E remains dependent on Task 8's local deterministic growth seed and a local `DATABASE_URL`; only Playwright discovery was available in this task.
- Production builds remain noisy without `DATABASE_URL`, matching the existing project behavior, although the build exits successfully.

## Review findings follow-up

Two required permission-regression findings were addressed after commit `73baac9`.

### Fixes

- Extracted `authorizeAdminRequest()` as the concrete authorization callback and assigned it directly to `authConfig.callbacks.authorized`.
- Added observable callback assertions that staff receives a redirect response with `Location: http://localhost/admin?denied=1`, anonymous access returns `false` for Auth.js sign-in, and admin access returns `true`.
- Moved the existing sidebar registry into `components/admin/adminNavigation.ts` and added `getAdminNavItems(role)`.
- Updated `AdminSidebar` to consume that single shared registry.
- Added assertions that the shared registry includes Growth for admins and excludes it for staff.

### Follow-up TDD evidence

#### Real callback RED

Command:

```text
npm.cmd test -- __tests__/growth/permissions.test.ts
```

Result before extraction: exit 1; 1/4 tests failed with `authorizeAdminRequest is not a function`. The three existing permission tests remained green.

#### Real callback GREEN

Same command after assigning the extracted function to `authConfig.callbacks.authorized`: exit 0; 1 file passed; 4/4 tests passed.

#### Sidebar visibility RED

Command:

```text
npm.cmd test -- __tests__/growth/permissions.test.ts
```

Result before the shared registry module existed: exit 1; Vitest failed to resolve `@/components/admin/adminNavigation`, the expected missing-feature boundary.

#### Sidebar visibility GREEN

Same command after moving the existing registry and updating the sidebar consumer: exit 0; 1 file passed; 5/5 tests passed.

### Follow-up verification

- `npm.cmd test -- __tests__/growth/permissions.test.ts __tests__/growth/dashboard.test.ts`
  - Exit 0; 2 files passed; 8/8 tests passed.
- `npm.cmd test`
  - Exit 0; 21 files passed; 161/161 tests passed.
- `npm.cmd run typecheck`
  - Exit 0; no TypeScript errors.
- `npm.cmd run lint`
  - Exit 0; no ESLint findings.
- `$env:AUTH_SECRET='task7-review-local-build-verification-only'; npm.cmd run build`
  - Exit 0; compiled successfully and generated 52/52 pages, including dynamic `/admin/growth`.
  - Existing missing-`DATABASE_URL` Prisma messages and the Tailwind module-type warning remained non-fatal.
- `.\node_modules\.bin\playwright.cmd test --list`
  - Exit 0; discovered 6 tests across the admin and storefront specs.
- `git diff --check`
  - Exit 0; no whitespace errors.

Independent re-review found no Critical, Important, or Minor issues. It confirmed the tested function is the actual Auth.js callback, the redirect/sign-in/allow assertions cover all three roles, the sidebar has one shared registry, and Growth remains admin-only. The live database-backed E2E concern above is unchanged.
