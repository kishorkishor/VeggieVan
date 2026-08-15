import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  growthSession: { upsert: vi.fn() },
  growthEvent: { create: vi.fn() },
  experimentExposure: { upsert: vi.fn() },
  product: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  persistPublicEvent,
  recordExposure,
  recordTrustedOrderCompleted,
} from "@/lib/growth/persistence";
import { assignVariant } from "@/lib/growth/experiments";

const attribution = {
  utmSource: "google",
  utmCampaign: "spring",
  landingPath: "/products",
  referrerCategory: "search" as const,
};

const validCheckoutStarted = {
  eventId: "evt_000000000001",
  sessionId: "sess_000000000001",
  occurredAt: "2026-07-19T10:00:00.000Z",
  name: "checkout_started" as const,
  properties: { cartValue: 1098, cartSize: 2 },
};
const serverNow = new Date("2026-07-19T10:00:00.000Z");

function runInteractiveTransaction() {
  prismaMock.$transaction.mockImplementation(async (callback: unknown) =>
    (callback as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(serverNow);
  runInteractiveTransaction();
  prismaMock.growthSession.upsert.mockResolvedValue({});
  prismaMock.growthEvent.create.mockResolvedValue({});
  prismaMock.experimentExposure.upsert.mockResolvedValue({});
  prismaMock.product.findUnique.mockResolvedValue({ id: "p01" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("persistPublicEvent", () => {
  it("treats a duplicate event id as a successful retry", async () => {
    prismaMock.growthEvent.create.mockRejectedValue({
      code: "P2002",
      meta: { modelName: "GrowthEvent", target: ["id"] },
    });

    await expect(persistPublicEvent(validCheckoutStarted, attribution)).resolves.toEqual({
      accepted: true,
      duplicate: true,
    });
  });

  it("does not misclassify a session-upsert unique failure as an event retry", async () => {
    const failure = {
      code: "P2002",
      meta: { modelName: "GrowthSession", target: ["id"] },
    };
    prismaMock.growthSession.upsert.mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(persistPublicEvent(validCheckoutStarted, attribution)).rejects.toBe(failure);
    expect(prismaMock.growthEvent.create).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("does not accept a non-id event uniqueness conflict as a duplicate retry", async () => {
    const failure = {
      code: "P2002",
      meta: { modelName: "GrowthEvent", target: ["sessionId", "occurredAt"] },
    };
    prismaMock.growthEvent.create.mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(persistPublicEvent(validCheckoutStarted, attribution)).rejects.toBe(failure);
    errorSpy.mockRestore();
  });

  it("does not confuse a string constraint ending in id with the event primary key", async () => {
    const failure = {
      code: "P2002",
      meta: { modelName: "GrowthEvent", target: "order_id" },
    };
    prismaMock.growthEvent.create.mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(persistPublicEvent(validCheckoutStarted, attribution)).rejects.toBe(failure);
    errorSpy.mockRestore();
  });

  it("creates the session and normalized event in one transaction", async () => {
    await expect(persistPublicEvent(validCheckoutStarted, attribution)).resolves.toEqual({
      accepted: true,
      duplicate: false,
    });

    expect(prismaMock.growthSession.upsert).toHaveBeenCalledWith({
      where: { id: "sess_000000000001" },
      create: {
        id: "sess_000000000001",
        utmSource: "google",
        utmMedium: undefined,
        utmCampaign: "spring",
        landingPath: "/products",
        referrerCategory: "search",
      },
      update: {},
    });
    expect(prismaMock.growthEvent.create).toHaveBeenCalledWith({
      data: {
        id: "evt_000000000001",
        sessionId: "sess_000000000001",
        name: "checkout_started",
        occurredAt: serverNow,
        receivedAt: serverNow,
        cartValue: 1098,
        cartSize: 2,
      },
    });
  });

  it("replaces future and stale client clocks with server receipt time", async () => {
    await persistPublicEvent({
      ...validCheckoutStarted,
      eventId: "evt_future_clock_0001",
      occurredAt: "2026-07-19T12:00:00.000Z",
    }, attribution);
    await persistPublicEvent({
      ...validCheckoutStarted,
      eventId: "evt_stale_clock_00001",
      occurredAt: "2026-07-19T08:00:00.000Z",
    }, attribution);

    for (const call of prismaMock.growthEvent.create.mock.calls) {
      expect(call[0].data).toMatchObject({ occurredAt: serverNow, receivedAt: serverNow });
    }
  });

  it("does not overwrite first-touch attribution on later requests", async () => {
    await persistPublicEvent(validCheckoutStarted, attribution);

    expect(prismaMock.growthSession.upsert.mock.calls[0][0].update).toEqual({});
  });

  it("rejects an unknown product before persisting its event", async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);
    const event = {
      ...validCheckoutStarted,
      name: "product_viewed" as const,
      properties: {
        productId: "missing-product",
        category: "essentials" as const,
        priceBand: "under_5" as const,
        placement: "catalog" as const,
      },
    };

    await expect(persistPublicEvent(event, attribution)).resolves.toEqual({
      accepted: false,
      reason: "invalid_product",
    });
    expect(prismaMock.growthEvent.create).not.toHaveBeenCalled();
  });

  it("rethrows non-duplicate database failures", async () => {
    const failure = new Error("database unavailable");
    prismaMock.growthEvent.create.mockRejectedValue(failure);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(persistPublicEvent(validCheckoutStarted, attribution)).rejects.toBe(failure);
    expect(errorSpy).toHaveBeenCalledWith("Growth event persistence failed", failure);
    errorSpy.mockRestore();
  });
});

describe("recordExposure", () => {
  it("upserts one exposure per session and allocation version", async () => {
    const exposedAt = new Date("2026-07-19T10:00:00.000Z");

    await recordExposure({
      sessionId: "sess_000000000001",
      experiment: "related_product_ranking_v1",
      variant: "treatment",
      exposedAt,
      attribution,
    });

    expect(prismaMock.experimentExposure.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId_experiment_version: {
          sessionId: "sess_000000000001",
          experiment: "related_product_ranking_v1",
          version: 1,
        },
      },
      create: {
        sessionId: "sess_000000000001",
        experiment: "related_product_ranking_v1",
        version: 1,
        variant: "treatment",
        exposedAt,
        receivedAt: serverNow,
      },
      update: {},
    }));
  });

  it("replaces a skewed exposure clock with server receipt time", async () => {
    await recordExposure({
      sessionId: "sess_000000000001",
      experiment: "related_product_ranking_v1",
      variant: "treatment",
      exposedAt: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(prismaMock.experimentExposure.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ exposedAt: serverNow, receivedAt: serverNow }),
    }));
  });

  it("rejects a variant that differs from deterministic assignment", async () => {
    await expect(recordExposure({
      sessionId: "sess_000000000001",
      experiment: "related_product_ranking_v1",
      variant: "control",
      exposedAt: new Date(),
    })).rejects.toThrow("INVALID_VARIANT");
    expect(prismaMock.experimentExposure.upsert).not.toHaveBeenCalled();
  });
});

describe("recordTrustedOrderCompleted", () => {
  const validTrustedOrder = {
    sessionId: "sess_000000000001",
    orderId: "ord_1",
    total: 1497,
    itemCount: 2,
  };

  it("rejects invalid trusted totals and item counts before any Prisma write", async () => {
    const invalidInputs = [
      { ...validTrustedOrder, total: -1 },
      { ...validTrustedOrder, total: 1497.5 },
      { ...validTrustedOrder, total: 100_000_001 },
      { ...validTrustedOrder, itemCount: 0 },
      { ...validTrustedOrder, itemCount: 1.5 },
      { ...validTrustedOrder, itemCount: 1000 },
    ];

    for (const input of invalidInputs) {
      await expect(recordTrustedOrderCompleted(input)).rejects.toThrow("INVALID_TRUSTED_ORDER_EVENT");
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs, experiment values, and unknown fields before Prisma writes", async () => {
    const invalidInputs = [
      { ...validTrustedOrder, sessionId: "person@example.com" },
      { ...validTrustedOrder, orderId: "bad/order" },
      {
        ...validTrustedOrder,
        experiments: { related_product_ranking_v1: "winner" },
      },
      {
        ...validTrustedOrder,
        experiments: { unknown_experiment: "control" },
      },
      { ...validTrustedOrder, customerEmail: "hidden@example.com" },
    ];

    for (const input of invalidInputs) {
      await expect(recordTrustedOrderCompleted(input as never)).rejects.toThrow("INVALID_TRUSTED_ORDER_EVENT");
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a trusted variant that differs from deterministic assignment", async () => {
    const assigned = assignVariant("sess_000000000001", "checkout_reassurance_v1");
    const mismatched = assigned === "control" ? "treatment" : "control";

    await expect(recordTrustedOrderCompleted({
      ...validTrustedOrder,
      experiments: { checkout_reassurance_v1: mismatched },
    })).rejects.toThrow("INVALID_VARIANT");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("normalizes the trusted order conversion and makes retries idempotent", async () => {
    await recordTrustedOrderCompleted({
      sessionId: "sess_000000000001",
      orderId: "ord_1",
      total: 1497,
      itemCount: 2,
      experiments: { related_product_ranking_v1: "treatment" },
    });

    expect(prismaMock.growthEvent.create).toHaveBeenCalledWith({
      data: {
        id: "order_ord_1",
        sessionId: "sess_000000000001",
        name: "order_completed",
        occurredAt: serverNow,
        receivedAt: serverNow,
        orderId: "ord_1",
        cartValue: 1497,
        cartSize: 2,
      },
    });
  });

  it("rejects caller-supplied chronology for trusted order conversions", async () => {
    await expect(recordTrustedOrderCompleted({
      ...validTrustedOrder,
      occurredAt: new Date("2026-07-18T10:00:00.000Z"),
    } as never)).rejects.toThrow("INVALID_TRUSTED_ORDER_EVENT");

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("accepts only an event-id conflict as a trusted conversion retry", async () => {
    prismaMock.growthEvent.create.mockRejectedValue({
      code: "P2002",
      meta: { modelName: "GrowthEvent", target: ["id"] },
    });

    await expect(recordTrustedOrderCompleted({
      sessionId: "sess_000000000001",
      orderId: "ord_1",
      total: 1497,
      itemCount: 2,
    })).resolves.toEqual({ accepted: true, duplicate: true });
  });
});
