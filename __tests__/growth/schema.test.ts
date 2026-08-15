import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  publicGrowthEventSchema,
  trustedOrderEventSchema,
} from "@/lib/growth/schema";

const base = {
  eventId: "evt_000000000001",
  sessionId: "sess_000000000001",
  occurredAt: "2026-07-19T10:00:00.000Z",
};

describe("publicGrowthEventSchema", () => {
  it("accepts a bounded add-to-cart event", () => {
    expect(publicGrowthEventSchema.safeParse({
      ...base,
      name: "add_to_cart",
      properties: {
        productId: "p01",
        quantity: 2,
        unitPrice: 549,
        cartValue: 1098,
        cartSize: 2,
        placement: "pdp",
      },
    }).success).toBe(true);
  });

  it("rejects trusted conversions and unknown personal fields", () => {
    expect(publicGrowthEventSchema.safeParse({
      ...base,
      name: "order_completed",
      properties: { orderId: "ord_1" },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...base,
      name: "product_viewed",
      properties: { productId: "p01", email: "person@example.com" },
    }).success).toBe(false);
  });

  it("rejects unknown keys at event, properties, attribution, and experiment levels", () => {
    const event = {
      ...base,
      name: "checkout_started",
      properties: { cartValue: 1098, cartSize: 2 },
    } as const;

    expect(publicGrowthEventSchema.safeParse({ ...event, email: "person@example.com" }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      properties: { ...event.properties, coupon: "SUMMER" },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      attribution: {
        landingPath: "/checkout",
        referrerCategory: "direct",
        email: "person@example.com",
      },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      experiments: { unknown_experiment: "control" },
    }).success).toBe(false);
  });

  it("rejects sensitive content in product IDs and acquisition fields", () => {
    const event = {
      ...base,
      name: "product_viewed",
      properties: {
        productId: "p01",
        category: "essentials",
        priceBand: "under_5",
        placement: "catalog",
      },
      attribution: {
        landingPath: "/catalog",
        referrerCategory: "search",
      },
    } as const;

    expect(publicGrowthEventSchema.safeParse({
      ...event,
      properties: { ...event.properties, productId: "person@example.com" },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      attribution: { ...event.attribution, utmSource: "person@example.com" },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      attribution: { ...event.attribution, utmCampaign: "https://example.com/campaign" },
    }).success).toBe(false);
  });

  it("rejects query strings and fragments in landing paths", () => {
    const event = {
      ...base,
      name: "checkout_started",
      properties: { cartValue: 1098, cartSize: 2 },
      attribution: { landingPath: "/checkout", referrerCategory: "direct" },
    } as const;

    expect(publicGrowthEventSchema.safeParse({
      ...event,
      attribution: { ...event.attribution, landingPath: "/checkout?email=person@example.com" },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      attribution: { ...event.attribution, landingPath: "/checkout#payment" },
    }).success).toBe(false);
  });

  it("enforces inclusive money and cart-size boundaries", () => {
    const event = {
      ...base,
      name: "checkout_started",
      properties: { cartValue: 0, cartSize: 1 },
    } as const;

    expect(publicGrowthEventSchema.safeParse(event).success).toBe(true);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      properties: { cartValue: 100_000_000, cartSize: 999 },
    }).success).toBe(true);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      properties: { cartValue: -1, cartSize: 1 },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      properties: { cartValue: 100_000_001, cartSize: 1 },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      properties: { cartValue: 0, cartSize: 0 },
    }).success).toBe(false);
    expect(publicGrowthEventSchema.safeParse({
      ...event,
      properties: { cartValue: 0, cartSize: 1000 },
    }).success).toBe(false);
  });

  it("accepts a valid partial experiment map", () => {
    expect(publicGrowthEventSchema.safeParse({
      ...base,
      name: "checkout_started",
      properties: { cartValue: 1098, cartSize: 2 },
      experiments: { checkout_reassurance_v1: "control" },
    }).success).toBe(true);
  });
});

describe("trustedOrderEventSchema", () => {
  it("accepts only the trusted order-completed contract", () => {
    expect(trustedOrderEventSchema.safeParse({
      ...base,
      name: "order_completed",
      properties: { orderId: "ord_1", orderTotal: 1098, itemCount: 2 },
    }).success).toBe(true);
    expect(trustedOrderEventSchema.safeParse({
      ...base,
      name: "add_to_cart",
      properties: { orderId: "ord_1", orderTotal: 1098, itemCount: 2 },
    }).success).toBe(false);
  });
});

describe("growth Prisma schema", () => {
  it("indexes source and campaign for dashboard breakdowns", () => {
    const prismaSchema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(prismaSchema).toContain("@@index([utmSource, utmCampaign])");
  });

  it("stores server-received chronology with timestamp-leading dashboard indexes", () => {
    const prismaSchema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

    expect(prismaSchema).toMatch(/model GrowthEvent[\s\S]*?receivedAt\s+DateTime[\s\S]*?@@index\(\[receivedAt\]\)/);
    expect(prismaSchema).toMatch(/model GrowthEvent[\s\S]*?@@index\(\[occurredAt\]\)/);
    expect(prismaSchema).toMatch(/model ExperimentExposure[\s\S]*?receivedAt\s+DateTime[\s\S]*?@@index\(\[receivedAt\]\)/);
    expect(prismaSchema).toMatch(/model ExperimentExposure[\s\S]*?@@index\(\[exposedAt\]\)/);
    expect(prismaSchema).toMatch(/model GrowthSession[\s\S]*?@@index\(\[firstSeenAt\]\)/);
  });
});
