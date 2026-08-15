# Rype Growth Engineering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-conscious first-party funnel analytics and experimentation layer with three real UI experiments, an admin-only growth dashboard, deterministic demo data, and portfolio-grade documentation.

**Architecture:** A focused `lib/growth` module owns experiment definitions, deterministic assignment, strict event contracts, persistence, and analytics calculations. Client components use a single growth provider and fail-open event transport; the existing order transaction records the trusted completion event. Prisma stores anonymous sessions, idempotent events, and unique exposures, while `/admin/growth` renders server-calculated results behind existing Auth.js role controls.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, Prisma 6/PostgreSQL, Auth.js v5, Zod, Vitest, Playwright, Tailwind CSS 4.

## Global Constraints

- Preserve existing storefront and admin behavior for control variants.
- Do not collect names, emails, addresses, phone numbers, raw referrer URLs, IP addresses, user-agent strings, device fingerprints, or arbitrary analytics metadata.
- `order_completed` is server-trusted only and cannot be accepted by the public event endpoint.
- All monetary values are bounded non-negative integer cents.
- Analytics failures must never block browsing, cart, checkout, or order creation.
- Assignments are deterministic, versioned, persisted, and 50/50.
- Exposures count only when experimental UI renders and are unique per session, experiment, and allocation version.
- Demo outcomes must be deterministic and labeled synthetic everywhere they appear.
- Do not publish, push, deploy, or modify external services.

## File structure

- `lib/growth/experiments.ts`: registry, assignment hash, and experiment types.
- `lib/growth/ranking.ts`: complementary-product treatment ranking.
- `lib/growth/schema.ts`: strict public and trusted event contracts.
- `lib/growth/client.ts`: browser identity, attribution allowlist, and fail-open transport.
- `lib/growth/GrowthProvider.tsx`: React context for stable assignments and event helpers.
- `lib/growth/persistence.ts`: idempotent session, event, exposure, and trusted-order writes.
- `lib/growth/analytics.ts`: pure funnel and experiment calculations.
- `lib/growth/queries.ts`: authenticated Prisma reads and dashboard assembly.
- `app/api/growth/events/route.ts`: public validated ingestion route.
- `app/api/growth/exposures/route.ts`: validated, idempotent experiment exposure route.
- `app/admin/growth/page.tsx`: protected server page.
- `app/admin/growth/GrowthDashboard.tsx`: recruiter-readable dashboard UI.
- `components/growth/ExperimentExposure.tsx`: render-time exposure helper.
- `components/growth/FreeShippingProgress.tsx`: cart treatment UI.
- `components/growth/CheckoutReassurance.tsx`: checkout treatment UI.

---

### Task 1: Experiment registry, assignment, and merchandising ranker

**Files:**
- Create: `lib/growth/experiments.ts`
- Create: `lib/growth/ranking.ts`
- Create: `__tests__/growth/experiments.test.ts`
- Create: `__tests__/growth/ranking.test.ts`

**Interfaces:**
- Produces: `ExperimentKey`, `Variant`, `ExperimentDefinition`, `EXPERIMENTS`, `assignVariant(sessionId, experimentKey)`, and `rankRelatedProducts(products, anchorCategory)`.
- Consumes: product-shaped values with `id`, `category`, and `stock` only; no Prisma dependency.

- [ ] **Step 1: Write failing assignment tests**

```ts
import { describe, expect, it } from "vitest";
import { assignVariant, EXPERIMENTS } from "@/lib/growth/experiments";

describe("assignVariant", () => {
  it("is stable for the same session and experiment", () => {
    expect(assignVariant("sess_000000000001", "checkout_reassurance_v1"))
      .toBe(assignVariant("sess_000000000001", "checkout_reassurance_v1"));
  });

  it("keeps every assignment inside the registered variants", () => {
    for (const key of Object.keys(EXPERIMENTS) as (keyof typeof EXPERIMENTS)[]) {
      expect(EXPERIMENTS[key].variants).toContain(assignVariant("sess_000000000002", key));
    }
  });

  it("produces both buckets across a deterministic sample", () => {
    const variants = new Set(Array.from({ length: 200 }, (_, index) =>
      assignVariant(`sess_${index.toString().padStart(12, "0")}`, "free_shipping_progress_v1")));
    expect(variants).toEqual(new Set(["control", "treatment"]));
  });
});
```

- [ ] **Step 2: Run the assignment test and verify it fails**

Run: `npm test -- __tests__/growth/experiments.test.ts`

Expected: FAIL because `@/lib/growth/experiments` does not exist.

- [ ] **Step 3: Implement the registry and deterministic FNV-1a bucket**

```ts
export const EXPERIMENTS = {
  checkout_reassurance_v1: { version: 1, variants: ["control", "treatment"], conversionEvent: "order_completed" },
  free_shipping_progress_v1: { version: 1, variants: ["control", "treatment"], conversionEvent: "checkout_started" },
  related_product_ranking_v1: { version: 1, variants: ["control", "treatment"], conversionEvent: "add_to_cart" },
} as const;

export type ExperimentKey = keyof typeof EXPERIMENTS;
export type Variant = "control" | "treatment";
export type ExperimentDefinition = (typeof EXPERIMENTS)[ExperimentKey];

export function assignVariant(sessionId: string, key: ExperimentKey): Variant {
  const value = `${sessionId}:${key}:${EXPERIMENTS[key].version}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 2 ** 32 < 0.5 ? "control" : "treatment";
}
```

- [ ] **Step 4: Write failing ranker tests**

```ts
it("puts in-stock complementary categories first with stable ties", () => {
  const products = [
    { id: "b", category: "fruits", stock: 4 },
    { id: "c", category: "herbs", stock: 0 },
    { id: "a", category: "herbs", stock: 4 },
  ];
  expect(rankRelatedProducts(products, "vegetables").map((product) => product.id))
    .toEqual(["a", "b", "c"]);
});

it("does not mutate the server-provided list", () => {
  const products = [{ id: "b", category: "fruits", stock: 1 }, { id: "a", category: "herbs", stock: 1 }];
  rankRelatedProducts(products, "vegetables");
  expect(products.map((product) => product.id)).toEqual(["b", "a"]);
});
```

- [ ] **Step 5: Implement the explicit affinity ranker and run both tests**

```ts
const AFFINITY: Record<string, readonly string[]> = {
  fruits: ["bundles", "herbs", "vegetables"],
  vegetables: ["herbs", "bundles", "fruits"],
  herbs: ["vegetables", "bundles", "fruits"],
  bundles: ["fruits", "vegetables", "herbs"],
};

export function rankRelatedProducts<T extends { id: string; category: string; stock: number }>(
  products: readonly T[], anchorCategory: string
): T[] {
  const affinity = AFFINITY[anchorCategory] ?? [];
  const affinityIndex = (category: string) => {
    const index = affinity.indexOf(category);
    return index === -1 ? affinity.length : index;
  };
  return [...products].sort((left, right) =>
    Number(right.stock > 0) - Number(left.stock > 0) ||
    affinityIndex(left.category) - affinityIndex(right.category) ||
    left.id.localeCompare(right.id));
}
```

Run: `npm test -- __tests__/growth/experiments.test.ts __tests__/growth/ranking.test.ts`

Expected: both files PASS.

- [ ] **Step 6: Commit**

```text
git add lib/growth/experiments.ts lib/growth/ranking.ts __tests__/growth/experiments.test.ts __tests__/growth/ranking.test.ts
git commit -m "feat: add deterministic growth experiments"
```

### Task 2: Strict event contracts and Prisma growth model

**Files:**
- Create: `lib/growth/schema.ts`
- Create: `__tests__/growth/schema.test.ts`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: experiment keys and variants from Task 1.
- Produces: `publicGrowthEventSchema`, `trustedOrderEventSchema`, `PublicGrowthEvent`, and Prisma models `GrowthSession`, `GrowthEvent`, and `ExperimentExposure`.

- [ ] **Step 1: Write failing strict-schema tests**

```ts
const base = { eventId: "evt_000000000001", sessionId: "sess_000000000001", occurredAt: "2026-07-19T10:00:00.000Z" };

it("accepts a bounded add-to-cart event", () => {
  expect(publicGrowthEventSchema.safeParse({
    ...base,
    name: "add_to_cart",
    properties: { productId: "p01", quantity: 2, unitPrice: 549, cartValue: 1098, cartSize: 2, placement: "pdp" },
  }).success).toBe(true);
});

it("rejects trusted conversions and unknown personal fields", () => {
  expect(publicGrowthEventSchema.safeParse({ ...base, name: "order_completed", properties: { orderId: "ord_1" } }).success).toBe(false);
  expect(publicGrowthEventSchema.safeParse({ ...base, name: "product_viewed", properties: { productId: "p01", email: "person@example.com" } }).success).toBe(false);
});
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run: `npm test -- __tests__/growth/schema.test.ts`

Expected: FAIL because `schema.ts` does not exist.

- [ ] **Step 3: Implement a strict discriminated union**

```ts
const opaqueId = z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/);
const entityId = z.string().trim().min(1).max(80);
const money = z.number().int().min(0).max(100_000_000);
const experimentsSchema = z.record(experimentKeySchema, variantSchema)
  .refine((value) => Object.keys(value).length <= 3, "At most three experiments are allowed");
const attributionSchema = z.object({
  utmSource: z.string().trim().max(80).optional(),
  utmMedium: z.string().trim().max(80).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  landingPath: z.string().startsWith("/").max(200),
  referrerCategory: z.enum(["direct", "search", "social", "referral", "internal"]),
}).strict();
const common = { eventId: opaqueId, sessionId: opaqueId, occurredAt: z.string().datetime(), experiments: experimentsSchema.optional(), attribution: attributionSchema.optional() };

export const publicGrowthEventSchema = z.discriminatedUnion("name", [
  z.object({ ...common, name: z.literal("product_viewed"), properties: z.object({ productId: entityId, category: z.enum(["fruits", "vegetables", "herbs", "bundles"]), priceBand: z.enum(["under_5", "5_to_10", "over_10"]), placement: z.enum(["catalog", "recommendation", "direct"]) }).strict() }).strict(),
  z.object({ ...common, name: z.literal("add_to_cart"), properties: z.object({ productId: entityId, quantity: z.number().int().min(1).max(999), unitPrice: money, cartValue: money, cartSize: z.number().int().min(1).max(999), placement: z.enum(["pdp", "listing", "recommendation", "other"]) }).strict() }).strict(),
  z.object({ ...common, name: z.literal("checkout_started"), properties: z.object({ cartValue: money, cartSize: z.number().int().min(1).max(999) }).strict() }).strict(),
  z.object({ ...common, name: z.literal("checkout_step_completed"), properties: z.object({ step: z.union([z.literal(1), z.literal(2), z.literal(3)]), stepName: z.enum(["address", "delivery", "payment"]), cartValue: money }).strict() }).strict(),
]);
```

- [ ] **Step 4: Add focused Prisma models and constraints**

```prisma
model GrowthSession {
  id               String               @id
  firstSeenAt      DateTime             @default(now())
  lastSeenAt       DateTime             @updatedAt
  utmSource        String?
  utmMedium        String?
  utmCampaign      String?
  landingPath      String?
  referrerCategory String?
  demo             Boolean              @default(false)
  events           GrowthEvent[]
  exposures        ExperimentExposure[]
}

model GrowthEvent {
  id           String        @id
  session      GrowthSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId    String
  name         String
  occurredAt   DateTime
  productId    String?
  orderId      String?
  cartValue    Int?
  cartSize     Int?
  quantity     Int?
  unitPrice    Int?
  placement    String?
  checkoutStep Int?
  demo         Boolean       @default(false)

  @@index([name, occurredAt])
  @@index([sessionId, occurredAt])
  @@index([orderId])
}

model ExperimentExposure {
  id         String        @id @default(cuid())
  session    GrowthSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sessionId  String
  experiment String
  version    Int
  variant    String
  exposedAt  DateTime
  demo       Boolean       @default(false)

  @@unique([sessionId, experiment, version])
  @@index([experiment, version, variant])
}
```

- [ ] **Step 5: Generate Prisma types and run tests**

Run: `npx prisma generate && npm test -- __tests__/growth/schema.test.ts`

Expected: Prisma generation succeeds and schema tests PASS.

- [ ] **Step 6: Commit**

```text
git add prisma/schema.prisma lib/growth/schema.ts __tests__/growth/schema.test.ts
git commit -m "feat: model validated growth events"
```

### Task 3: Idempotent persistence, ingestion route, and client transport

**Files:**
- Create: `lib/growth/persistence.ts`
- Create: `lib/growth/client.ts`
- Create: `app/api/growth/events/route.ts`
- Create: `app/api/growth/exposures/route.ts`
- Create: `__tests__/growth/persistence.test.ts`
- Create: `__tests__/growth/client.test.ts`
- Create: `__tests__/growth/route.test.ts`

**Interfaces:**
- Consumes: Task 1 registry and Task 2 schemas/Prisma models.
- Produces: `persistPublicEvent(event)`, `recordExposure(input)`, `recordTrustedOrderCompleted(input)`, `getGrowthIdentity()`, `trackGrowthEvent(event)`, `trackExposure(input)`, and the two route `POST` handlers.

- [ ] **Step 1: Write persistence tests for idempotency and exposure uniqueness**

```ts
it("treats a duplicate event id as a successful retry", async () => {
  prismaMock.growthEvent.create.mockRejectedValue({ code: "P2002" });
  await expect(persistPublicEvent(validEvent, attribution)).resolves.toEqual({ accepted: true, duplicate: true });
});

it("upserts one exposure per session and allocation version", async () => {
  await recordExposure({ sessionId: "sess_000000000001", experiment: "free_shipping_progress_v1", variant: "treatment", exposedAt: new Date() });
  expect(prismaMock.experimentExposure.upsert).toHaveBeenCalledWith(expect.objectContaining({
    where: { sessionId_experiment_version: { sessionId: "sess_000000000001", experiment: "free_shipping_progress_v1", version: 1 } },
  }));
});
```

- [ ] **Step 2: Implement transactional session/event writes and exposure upsert**

Use `prisma.$transaction` to upsert first-touch attribution without overwriting non-null acquisition values, then create the normalized event. Catch only Prisma `P2002` for duplicate event IDs; log and rethrow other failures so the route can return `503` while the browser remains fail-open.

```ts
export async function recordExposure(input: ExposureInput) {
  const definition = EXPERIMENTS[input.experiment];
  if (assignVariant(input.sessionId, input.experiment) !== input.variant) throw new Error("INVALID_VARIANT");
  return prisma.experimentExposure.upsert({
    where: { sessionId_experiment_version: { sessionId: input.sessionId, experiment: input.experiment, version: definition.version } },
    create: { ...input, version: definition.version },
    update: {},
  });
}
```

- [ ] **Step 3: Write route tests and implement the POST handler**

```ts
it("returns 400 for an invalid or trusted event", async () => {
  const response = await POST(new Request("http://localhost/api/growth/events", { method: "POST", body: JSON.stringify({ name: "order_completed" }) }));
  expect(response.status).toBe(400);
});

it("returns 202 for a validated event", async () => {
  persistPublicEventMock.mockResolvedValue({ accepted: true, duplicate: false });
  const response = await POST(requestFor(validProductViewed));
  expect(response.status).toBe(202);
});
```

The event route must cap `content-length` at 16 KB, parse JSON safely, validate with `publicGrowthEventSchema`, accept only the strict allowlisted attribution object, return `202` for accepted/duplicate events, `400` for invalid input, `413` for oversized input, and `503` for persistence failure. The exposure route validates `{ sessionId, experiment, variant, exposedAt, attribution }`, confirms the variant matches deterministic assignment, upserts the session/exposure, and uses the same response/error conventions.

- [ ] **Step 4: Write client tests and implement stable identity/allowlisted attribution**

```ts
it("keeps the generated opaque session id and only allowlisted campaign values", () => {
  history.replaceState({}, "", "/products?utm_source=google&utm_campaign=spring&email=hidden@example.com");
  const identity = getGrowthIdentity();
  expect(identity.sessionId).toMatch(/^sess_[a-f0-9-]{36}$/);
  expect(identity.attribution).toEqual(expect.objectContaining({ utmSource: "google", utmCampaign: "spring" }));
  expect(JSON.stringify(identity)).not.toContain("hidden@example.com");
});
```

`trackGrowthEvent` and `trackExposure` must use `fetch(..., { method: "POST", keepalive: true })`, swallow transport errors, and never retry synchronously in the shopper interaction path. They post only to `/api/growth/events` and `/api/growth/exposures` respectively.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- __tests__/growth/persistence.test.ts __tests__/growth/client.test.ts __tests__/growth/route.test.ts`

Expected: all focused tests PASS.

```text
git add lib/growth/persistence.ts lib/growth/client.ts app/api/growth/events/route.ts app/api/growth/exposures/route.ts __tests__/growth
git commit -m "feat: ingest growth events safely"
```

### Task 4: Growth provider, storefront instrumentation, and three treatment UIs

**Files:**
- Create: `lib/growth/GrowthProvider.tsx`
- Create: `components/growth/ExperimentExposure.tsx`
- Create: `components/growth/FreeShippingProgress.tsx`
- Create: `components/growth/CheckoutReassurance.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/layout/CartDrawer.tsx`
- Modify: `components/product/ProductCard.tsx`
- Modify: `app/products/[slug]/PDPClient.tsx`
- Modify: `app/checkout/page.tsx`
- Create: `__tests__/growth/provider.test.ts`
- Create: `__tests__/growth/instrumentation.test.ts`

**Interfaces:**
- Consumes: Task 1 assignment/ranking and Task 3 transport/exposure endpoint.
- Produces: `useGrowth()`, `GrowthProvider`, `ExperimentExposure`, and treatment components.

- [ ] **Step 1: Write provider tests for persisted variants and event context**

```ts
it("persists assigned variants and attaches them to tracked events", () => {
  const first = initializeGrowth("sess_000000000001", storage);
  const second = initializeGrowth("sess_000000000001", storage);
  expect(second.assignments).toEqual(first.assignments);
  expect(Object.keys(second.assignments)).toEqual(Object.keys(EXPERIMENTS));
});
```

- [ ] **Step 2: Implement one root provider**

The provider initializes after hydration, persists a `{ experimentKey: variant }` map under `rype-growth-assignments-v1`, exposes `variant(key)`, `track(name, properties)`, and `expose(key)`, and renders children immediately so analytics initialization never gates the app.

```ts
type GrowthContextValue = {
  ready: boolean;
  variant: (key: ExperimentKey) => Variant;
  expose: (key: ExperimentKey) => void;
  track: (event: PublicGrowthEventInput) => void;
};
```

- [ ] **Step 3: Wrap the existing providers without changing layout behavior**

In `app/layout.tsx`, place `GrowthProvider` inside the existing client/provider boundary and outside storefront content. Do not reorder Auth.js, catalog, toaster, header, or cart providers.

- [ ] **Step 4: Instrument product view and add-to-cart placements**

`PDPClient` records `product_viewed` once per product ID after hydration. `PDPClient` and `ProductCard` emit `add_to_cart` immediately after the existing Zustand mutation with the resulting cart totals. Add a `placement` prop to `ProductCard`, defaulting to `listing`, and pass `recommendation` from related-product rendering.

- [ ] **Step 5: Apply merchandising treatment after exposure**

In `PDPClient`, call `expose("related_product_ranking_v1")` when the related section renders. Use the original array for control and `rankRelatedProducts(related, p.category)` for treatment. Preserve the current grid and card behavior.

- [ ] **Step 6: Apply free-shipping progress treatment in the cart drawer**

Render `FreeShippingProgress` only for treatment and record exposure when it mounts. The component uses the existing `FREE_SHIPPING_AT` constant and current subtotal:

```tsx
const remaining = Math.max(0, FREE_SHIPPING_AT - subtotal);
return remaining === 0
  ? <p>You unlocked free delivery.</p>
  : <div aria-label={`${Math.round(subtotal / FREE_SHIPPING_AT * 100)}% toward free delivery`}>Add {formatEUR(remaining)} for free delivery.</div>;
```

Treatment CTA copy becomes `Continue to secure checkout`; control retains current copy.

- [ ] **Step 7: Apply checkout reassurance and step instrumentation**

When checkout renders with a non-empty cart, expose both checkout experiments and emit `checkout_started` once. After `trigger()` succeeds for address, emit step 1; when delivery advances emit step 2; immediately before the validated order submission emit step 3. Treatment renders `CheckoutReassurance` with delivery, no-surprise-fees, and freshness-guarantee copy; control markup remains unchanged.

- [ ] **Step 8: Run unit and storefront E2E tests, then commit**

Run: `npm test -- __tests__/growth/provider.test.ts __tests__/growth/instrumentation.test.ts`

Run: `npm run build && npm run e2e -- e2e/storefront.spec.ts`

Expected: focused tests and the existing storefront path PASS for deterministic control and treatment session IDs.

```text
git add app/layout.tsx app/checkout/page.tsx app/products components lib/growth/GrowthProvider.tsx __tests__/growth
git commit -m "feat: instrument storefront experiments"
```

### Task 5: Trusted order conversion persistence

**Files:**
- Modify: `lib/orders/actions.ts`
- Modify: `app/checkout/page.tsx`
- Modify: `__tests__/lib/orderActions.test.ts`
- Create: `__tests__/growth/orderConversion.test.ts`

**Interfaces:**
- Consumes: `recordTrustedOrderCompleted` and the browser growth session/assignment context.
- Produces: optional `growth` input on `placeOrderAction` containing only session ID and registered variants.

- [ ] **Step 1: Extend order-action tests with safe optional growth context**

```ts
it("records a trusted conversion after a successful order", async () => {
  const result = await placeOrderAction({ ...validOrder, growth: { sessionId: "sess_000000000001", experiments: { checkout_reassurance_v1: "treatment" } } });
  expect(result.ok).toBe(true);
  expect(recordTrustedOrderCompletedMock).toHaveBeenCalledWith(expect.objectContaining({ orderId: "ord_test", total: 1497 }));
});

it("does not fail checkout when analytics persistence fails", async () => {
  recordTrustedOrderCompletedMock.mockRejectedValue(new Error("analytics unavailable"));
  await expect(placeOrderAction(validOrderWithGrowth)).resolves.toEqual(expect.objectContaining({ ok: true }));
});
```

- [ ] **Step 2: Add a strict optional growth object to `placeSchema`**

```ts
growth: z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),
  experiments: z.record(experimentKeySchema, variantSchema)
    .refine((value) => Object.keys(value).length <= 3, "At most three experiments are allowed"),
}).strict().optional()
```

- [ ] **Step 3: Persist conversion only after the order transaction commits**

Call `recordTrustedOrderCompleted` in a separate guarded `try/catch` after `order` exists. Validate each supplied variant against deterministic assignment before storing exposure/conversion context. Do not place analytics inside the inventory/order transaction, because analytics failure must not roll back a legitimate order.

- [ ] **Step 4: Pass growth context from checkout and verify**

Use the provider’s opaque session ID and assignment map. Do not pass checkout form values into growth code.

Run: `npm test -- __tests__/lib/orderActions.test.ts __tests__/growth/orderConversion.test.ts`

Expected: tests PASS, including analytics-failure fail-open behavior.

- [ ] **Step 5: Commit**

```text
git add lib/orders/actions.ts app/checkout/page.tsx __tests__/lib/orderActions.test.ts __tests__/growth/orderConversion.test.ts
git commit -m "feat: record trusted order conversions"
```

### Task 6: Funnel and experiment calculations with authenticated queries

**Files:**
- Create: `lib/growth/analytics.ts`
- Create: `lib/growth/queries.ts`
- Create: `__tests__/growth/analytics.test.ts`
- Create: `__tests__/growth/queries.test.ts`

**Interfaces:**
- Consumes: normalized events/exposures from Prisma and `auth()`.
- Produces: `calculateFunnel(rows)`, `calculateExperimentResults(exposures, events)`, `wilsonInterval(successes, total)`, and `getGrowthDashboardData()`.

- [ ] **Step 1: Write funnel deduplication tests**

```ts
it("counts each session once per funnel stage", () => {
  const result = calculateFunnel([
    event("s1", "product_viewed"), event("s1", "product_viewed"), event("s1", "add_to_cart"),
    event("s2", "product_viewed"),
  ]);
  expect(result.stages).toEqual([
    expect.objectContaining({ name: "product_viewed", sessions: 2 }),
    expect.objectContaining({ name: "add_to_cart", sessions: 1, previousRate: 0.5 }),
  ]);
});
```

- [ ] **Step 2: Write experiment calculation tests**

```ts
it("attributes only conversions at or after first exposure", () => {
  const result = calculateExperimentResults(exposures, [eventBeforeExposure, eventAfterExposure]);
  expect(result[0].variants.treatment.conversions).toBe(1);
});

it("marks fewer than 100 sessions per variant as insufficient", () => {
  expect(calculateExperimentResults(smallSampleExposures, []).at(0)?.evidence).toBe("insufficient");
});
```

- [ ] **Step 3: Implement pure calculations**

Use sets keyed by session for funnel stages. For each experiment, group first exposures by variant, count sessions with the registry-defined conversion event at or after exposure, calculate rates, treatment-minus-control absolute lift, allocation balance, and Wilson 95% intervals. Set `evidence: "insufficient"` unless both variants have at least 100 exposed sessions. Never emit a `winner` field.

- [ ] **Step 4: Write and implement permission tests for dashboard queries**

```ts
it("rejects staff and anonymous sessions before querying growth rows", async () => {
  authMock.mockResolvedValue({ user: { role: "staff" } });
  await expect(getGrowthDashboardData()).rejects.toThrow("Admin only");
  expect(prismaMock.growthEvent.findMany).not.toHaveBeenCalled();
});
```

`getGrowthDashboardData` calls `auth()` first, requires `role === "admin"`, then loads a documented 30-day window of events, exposures, and session attribution. It returns `{ funnel, experiments, acquisition, includesDemo, window }`.

- [ ] **Step 5: Run tests and commit**

Run: `npm test -- __tests__/growth/analytics.test.ts __tests__/growth/queries.test.ts`

Expected: calculation and authorization tests PASS.

```text
git add lib/growth/analytics.ts lib/growth/queries.ts __tests__/growth/analytics.test.ts __tests__/growth/queries.test.ts
git commit -m "feat: calculate honest growth results"
```

### Task 7: Admin-only growth dashboard

**Files:**
- Create: `app/admin/growth/page.tsx`
- Create: `app/admin/growth/GrowthDashboard.tsx`
- Modify: `auth.config.ts`
- Modify: `components/admin/AdminSidebar.tsx`
- Create: `__tests__/growth/permissions.test.ts`
- Modify: `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `getGrowthDashboardData()` from Task 6.
- Produces: recruiter-readable `/admin/growth` with explicit demo and evidence states.

- [ ] **Step 1: Extend authorization tests**

Extract or export the admin-path role decision so Vitest can assert that `/admin/growth` redirects staff to `/admin?denied=1`, permits admin, and sends anonymous users to sign-in through Auth.js.

```ts
expect(isAdminOnlyPath("/admin/growth")).toBe(true);
expect(isAdminOnlyPath("/admin/growth/details")).toBe(true);
```

- [ ] **Step 2: Add the Growth navigation item for admins only**

Add `{ href: "/admin/growth", label: "Growth", icon: TrendingUp, roles: ["admin"] }` to the existing sidebar registry. Add `/admin/growth` to `adminOnly` in `auth.config.ts`.

- [ ] **Step 3: Implement the server page with existing DB-error behavior**

```tsx
export default async function GrowthPage() {
  try {
    return <GrowthDashboard data={await getGrowthDashboardData()} />;
  } catch (error) {
    if (error instanceof Error && error.message === "Admin only") notFound();
    return <GrowthDashboard data={emptyGrowthDashboardData()} dbError="Growth analytics are unavailable. Check DATABASE_URL and run the seed." />;
  }
}
```

- [ ] **Step 4: Build the dashboard UI**

Render a page header with 30-day window and demo badge, five funnel stage cards with rates, source/campaign table, and one experiment card per registry entry. Each experiment card must render exposures, conversions, rate, absolute lift, allocation balance, Wilson interval, and the exact copy `Insufficient evidence — directional only` below 100 sessions per variant. Include a limitations panel and never render winner/loser copy.

- [ ] **Step 5: Extend admin E2E**

After admin login, navigate to Growth, assert the page heading, `Seeded demo data`, funnel stages, all three experiment names, and the evidence caveat. Retain the existing orders drawer test as a separate test so prior behavior remains covered.

- [ ] **Step 6: Run focused checks and commit**

Run: `npm test -- __tests__/growth/permissions.test.ts`

Run: `npm run typecheck && npm run build`

Expected: tests, typecheck, and build PASS.

```text
git add app/admin/growth auth.config.ts components/admin/AdminSidebar.tsx __tests__/growth/permissions.test.ts e2e/admin.spec.ts
git commit -m "feat: add admin growth dashboard"
```

### Task 8: Deterministic demo data, portfolio README, screenshots, and final verification

**Files:**
- Modify: `prisma/seed.ts`
- Create: `__tests__/growth/seed.test.ts`
- Modify: `README.md`
- Create: `public/readme-growth-dashboard.png`
- Modify: `.env.local.example` only if an explicit demo toggle is needed; prefer persisted `demo` flags instead.

**Interfaces:**
- Consumes: all growth Prisma models, registry definitions, and dashboard UI.
- Produces: idempotent seeded analytics and finished portfolio presentation.

- [ ] **Step 1: Write a deterministic seed-builder test**

Extract a pure `buildGrowthDemoRows(anchorDate)` function. Assert two invocations with `new Date("2026-07-19T00:00:00.000Z")` produce identical IDs, assignments, exposure counts, event counts, and variant distribution; assert every row has `demo: true` and contains no customer fields.

- [ ] **Step 2: Implement and persist deterministic demo rows**

Generate at least 240 sessions per experiment across direct, Google paid search, organic search, and social campaigns. Use stable session/event IDs and fixed offsets from the seed anchor. Produce plausible but intentionally non-conclusive variant differences. Delete only rows where `demo: true`, then recreate them transactionally; never delete real growth rows.

- [ ] **Step 3: Run seed tests and, when `DATABASE_URL` is available, seed twice**

Run: `npm test -- __tests__/growth/seed.test.ts`

Expected: deterministic builder tests PASS.

Run with a configured local demo database: `npm run db:push && npm run db:seed && npm run db:seed`

Expected: both seed runs succeed with identical growth row totals.

- [ ] **Step 4: Rewrite README around the case study**

Lead with the business problem and hypotheses. Add event taxonomy, architecture diagram, privacy table, assignment/exposure methodology, primary metrics, demo data warning, dashboard instructions, screenshot, testing evidence, limitations, and the production rollout checklist from the approved design. Preserve accurate storefront/admin setup details and remove stale test-count badges or replace them with non-numeric labels.

- [ ] **Step 5: Capture and verify the dashboard screenshot**

With deterministic demo data loaded, run the production app, sign in as the seeded admin, and capture `/admin/growth` at a desktop viewport to `public/readme-growth-dashboard.png`. Confirm the image visibly includes the `Seeded demo data` badge and does not expose credentials or customer identity.

- [ ] **Step 6: Run the complete verification suite**

Run, in order:

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

Expected: every command exits 0. Document any external prerequisite preventing database-backed E2E separately; do not report it as passing without evidence.

- [ ] **Step 7: Review the diff for privacy and scope**

Search for forbidden analytics fields and accidental secrets:

```text
rg -n "customerEmail|customerName|customerAddress|phone|userAgent|ipAddress" lib/growth app/api/growth app/admin/growth prisma/seed.ts
git diff --check
git status --short
```

Expected: forbidden fields do not appear in growth storage/transport, `git diff --check` is clean, and only intentional files are modified.

- [ ] **Step 8: Commit the finished case study**

```text
git add prisma/seed.ts __tests__/growth/seed.test.ts README.md public/readme-growth-dashboard.png
git commit -m "docs: present Rype growth engineering case study"
```

## Final acceptance evidence

- Control variants preserve current storefront/admin behavior.
- All five funnel events are visible in code and documented.
- All three experiment assignments are deterministic and persisted.
- Public event validation is strict and duplicate-safe.
- Trusted order conversion cannot be submitted publicly.
- `/admin/growth` is protected in middleware, navigation, and server queries.
- Dashboard math deduplicates sessions and labels small samples honestly.
- Seed data is deterministic and visibly synthetic.
- README contains hypotheses, taxonomy, architecture, privacy, methodology, demo instructions, screenshot, limitations, and rollout requirements.
- Lint, typecheck, unit tests, build, and E2E have recorded exit-zero evidence before handoff.
