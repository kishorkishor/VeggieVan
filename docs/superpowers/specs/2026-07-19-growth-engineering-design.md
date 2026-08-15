# Rype Growth Engineering Design

## Objective

Extend Rype with a production-minded, first-party growth experimentation and analytics layer while preserving the existing storefront and admin behavior. The result must demonstrate full-stack engineering, performance marketing, conversion optimization, privacy judgment, and honest interpretation of experimental data.

The work will instrument the commerce funnel, run three deterministic experiments, persist validated analytics data, expose an admin-only growth dashboard, provide deterministic demo data, and explain the system as a flagship portfolio case study. Seeded outcomes will always be labeled as demo results and never presented as real customer performance.

## Business hypotheses

Rype will demonstrate three related hypotheses:

1. **Checkout reassurance:** Benefit-led checkout copy and concise delivery/freshness reassurance may reduce uncertainty and improve completed-order conversion among exposed sessions.
2. **Free-shipping progress:** Showing progress toward free shipping may increase checkout starts and encourage commercially useful basket building without changing the shipping policy.
3. **Related-product ranking:** Ranking in-stock complementary items before generic related products may improve add-to-cart conversion from product-detail recommendations.

These are portfolio hypotheses, not claims of observed customer behavior. The dashboard will report descriptive results and limitations rather than manufacture a winner.

## Chosen approach

Use one compact first-party growth module shared by all three experiments. It will contain:

- a versioned experiment registry;
- stable deterministic assignment;
- browser session and attribution handling;
- strict event-specific validation;
- Prisma persistence with idempotency constraints;
- server-side funnel and experiment calculations;
- an admin-only dashboard;
- deterministic seed data.

This approach follows existing Next.js App Router, Auth.js, Prisma, Zod, Vitest, and Playwright patterns. It avoids an external analytics dependency and avoids building a general-purpose experimentation platform with targeting rules, lifecycle management, or automated rollout.

## Architecture

### Anonymous session and attribution

The browser creates an opaque random session identifier and stores it as a first-party value. The identifier is not derived from identity, device attributes, IP address, or browser fingerprinting. The client captures only these allowlisted acquisition fields:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- landing path
- coarse referrer category such as direct, search, social, referral, or internal

Raw referrer URLs, query strings outside the allowlist, customer details, addresses, email addresses, names, phone numbers, IP addresses, user-agent strings, and arbitrary metadata are excluded.

### Experiment assignment

Each experiment is registered with a stable key, allocation version, variants, and conversion event. Assignment uses a deterministic hash of:

```text
sessionId + experimentKey + allocationVersion
```

The hash maps sessions to a 50/50 control or treatment bucket. Persisted browser assignments prevent variant switching. The allocation version forms part of the identity so future redesigns do not contaminate earlier results.

Assignment and exposure are separate. Assignment decides what to render; exposure is recorded only when the relevant experimental UI is rendered to the session. A database uniqueness constraint allows at most one exposure for a session, experiment key, and allocation version. Experiment conversion uses intention-to-treat from first recorded exposure.

### Event ingestion

The browser sends small, non-blocking requests to a first-party `/api/growth/events` endpoint. Event collection is fail-open: network or persistence errors do not block storefront, cart, checkout, or order creation.

The endpoint uses a strict discriminated Zod schema. It rejects unknown event names, unknown properties, malformed identifiers, invalid step values, negative monetary values, excessive quantities, and oversized strings. Every event has a client-generated idempotency ID; the database enforces uniqueness so retries cannot double count.

The primary conversion event, `order_completed`, is persisted from the trusted server order flow only after the order transaction succeeds. The client cannot submit this event through the public ingestion endpoint.

### Persistence

Prisma will add focused growth models for:

- anonymous sessions and allowlisted first-touch attribution;
- validated funnel events;
- deterministic experiment assignments and first exposures.

Events may reference a product ID, cart value in cents, cart size, checkout step, placement, or order ID when appropriate. They will not store customer PII. Database indexes will support time-window, event-name, session, campaign, and experiment reporting. Unique constraints will protect event idempotency and exposure deduplication.

## Event taxonomy

### `product_viewed`

Recorded once per product detail page view. Properties:

- product ID
- category
- price band, not free-form product metadata
- placement/source
- active experiment variants

### `add_to_cart`

Recorded at the actual cart mutation. Properties:

- product ID
- quantity
- unit price in cents
- resulting cart value in cents
- resulting cart item count
- placement: product page, product listing, recommendation, or other allowlisted value

### `checkout_started`

Recorded when the checkout page renders with a non-empty cart. Properties:

- cart value in cents
- cart item count
- active checkout-related experiment variants

### `checkout_step_completed`

Recorded only after the relevant checkout step validates. Properties:

- step number
- step name from the address, delivery, or payment allowlist
- cart value in cents

### `order_completed`

Recorded server-side after successful order persistence. Properties:

- non-personal order ID
- order total in cents
- item count
- anonymous session ID when supplied and validated
- active experiment variants when supplied and validated

## Experiment behavior

### `checkout_reassurance_v1`

Control retains the current checkout presentation. Treatment uses benefit-led basket checkout copy and displays a concise delivery/freshness reassurance element through checkout. The primary metric is completed-order conversion among exposed sessions. Secondary diagnostic metrics are checkout starts and step completion.

### `free_shipping_progress_v1`

Control retains the current totals-only cart presentation. Treatment displays progress toward the existing free-shipping threshold and changes to a success message once reached. It does not change prices or shipping rules. The primary metric is checkout-start conversion among exposed sessions; cart value is a descriptive secondary metric.

### `related_product_ranking_v1`

Control preserves current related-product ordering. Treatment ranks in-stock complementary categories first using a documented affinity map and stable tie-breaking. It does not introduce personalization or a machine-learning claim. The primary metric is add-to-cart conversion from recommendation placement among exposed product-detail sessions.

## Dashboard

Add `/admin/growth` as an admin-only route. Protection will exist in middleware, sidebar role visibility, and server-side query authorization. Staff users will follow the existing safe redirect pattern and cannot access growth data directly.

The dashboard will provide:

- funnel session counts for product view, add to cart, checkout start, checkout steps, and completed order;
- step-to-step and overall conversion rates;
- a compact visual funnel;
- allowlisted source and campaign breakdowns;
- exposure count, conversion count, conversion rate, absolute lift, and allocation balance by variant;
- clear primary metric labels for each experiment;
- a visible `Seeded demo data` badge whenever demo rows are included;
- an `Insufficient evidence` state below 100 exposed sessions per variant;
- confidence intervals as descriptive uncertainty, not a winner declaration;
- explicit caveats about repeated sessions, attribution scope, seed data, and sample size.

Funnel calculations deduplicate by anonymous session so repeated actions do not inflate conversion. Experiment calculations use first exposure per session and conversions occurring at or after exposure.

## Demo mode

The existing Prisma seed will generate a deterministic set of anonymous growth sessions, events, assignments, and exposures across acquisition sources and all experiment variants. The data will contain plausible variation so the dashboard is meaningful to inspect, but it will be explicitly marked as synthetic demo data in both the records and UI.

Seeding will be idempotent. Existing demo orders may be linked by non-personal order ID where useful, but no seeded customer identity will be copied into growth tables.

## Error handling and safeguards

- Analytics failures never block commerce behavior.
- Client submissions cannot create `order_completed` events.
- Strict schemas reject unknown fields and invalid event/property combinations.
- Event IDs and exposure uniqueness prevent duplicate counting.
- Monetary values use integer cents and bounded non-negative integers.
- Assignment keys and variants must exist in the experiment registry.
- Dashboard queries return explicit empty states when the database has no analytics data.
- Database connection errors follow the existing admin warning pattern without exposing internal details.
- No automated winner selection, traffic reallocation, or production rollout control is included.

## Testing strategy

Vitest coverage will include:

- deterministic assignment stability, versioning, and bucket boundaries;
- strict event validation, trusted-event rejection, and property limits;
- event idempotency and exposure uniqueness behavior through mocked Prisma calls;
- related-product ranking and stable tie-breaking;
- funnel session deduplication and step conversion calculations;
- experiment exposure, conversion, lift, uncertainty, and insufficient-evidence calculations;
- server-side admin permission enforcement for growth queries;
- route authorization for anonymous, staff, and admin roles;
- seed/demo labeling decisions.

Playwright coverage will extend the critical storefront flow to verify that product view, add-to-cart, checkout start, and validated checkout-step interactions remain healthy while experiments are active. An authenticated admin path will verify growth navigation, demo labeling, and experiment result rendering when a seeded database is available.

The final verification target is:

```text
npm run lint
npm run typecheck
npm run build
npm run test
npm run e2e
```

## Documentation and portfolio presentation

The README will be reframed around the growth-engineering case study and include:

- the business hypotheses;
- event taxonomy and primary metrics;
- architecture and data flow;
- deterministic assignment methodology;
- privacy and attribution decisions;
- dashboard and demo instructions;
- screenshots generated from deterministic demo data;
- limitations and production rollout requirements;
- an explicit statement that demo results are synthetic, not customer outcomes.

Production rollout requirements will mention consent/legal review, retention and deletion policies, bot/internal traffic filtering, identity stitching rules, monitoring, data warehouse or analytics export, power analysis, pre-registered metrics and stopping rules, experiment lifecycle controls, and operational ownership.

## Scope boundaries

This work will not:

- add an external analytics or experimentation vendor;
- collect personal data for analytics;
- claim causal or statistically significant outcomes from seed data;
- create real payment processing;
- implement automated targeting, rollout, or winner selection;
- publish, push, deploy, or modify external services;
- rewrite unrelated storefront or admin architecture.

Obvious credibility issues encountered in touched areas may be fixed when the change is small and verified. Broader dependency upgrades, unrelated visual rewrites, and repository-wide refactors remain out of scope.

