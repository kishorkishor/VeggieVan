import { beforeEach, describe, expect, it, vi } from "vitest";

const persistenceMocks = vi.hoisted(() => ({
  persistPublicEvent: vi.fn(),
  recordExposure: vi.fn(),
}));

vi.mock("@/lib/growth/persistence", () => persistenceMocks);

import { POST as postEvent } from "@/app/api/growth/events/route";
import { POST as postExposure } from "@/app/api/growth/exposures/route";

const validProductViewed = {
  eventId: "evt_000000000001",
  sessionId: "sess_000000000001",
  occurredAt: "2026-07-19T10:00:00.000Z",
  name: "product_viewed",
  properties: {
    productId: "p01",
    category: "essentials",
    priceBand: "under_5",
    placement: "catalog",
  },
  attribution: {
    utmSource: "google",
    landingPath: "/products",
    referrerCategory: "search",
  },
};

function requestFor(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/growth/events", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  persistenceMocks.persistPublicEvent.mockResolvedValue({ accepted: true, duplicate: false });
  persistenceMocks.recordExposure.mockResolvedValue({});
});

describe("POST /api/growth/events", () => {
  it("returns 400 for an invalid or trusted event", async () => {
    const response = await postEvent(requestFor({ name: "order_completed" }));

    expect(response.status).toBe(400);
    expect(persistenceMocks.persistPublicEvent).not.toHaveBeenCalled();
  });

  it("returns 202 for a validated event", async () => {
    const response = await postEvent(requestFor(validProductViewed));

    expect(response.status).toBe(202);
    expect(persistenceMocks.persistPublicEvent).toHaveBeenCalledWith(validProductViewed);
  });

  it("returns 400 for unknown attribution fields", async () => {
    const response = await postEvent(requestFor({
      ...validProductViewed,
      attribution: { ...validProductViewed.attribution, email: "hidden@example.com" },
    }));

    expect(response.status).toBe(400);
    expect(persistenceMocks.persistPublicEvent).not.toHaveBeenCalled();
  });

  it("returns 400 for an uncoarsened landing path", async () => {
    const response = await postEvent(requestFor({
      ...validProductViewed,
      attribution: {
        ...validProductViewed.attribution,
        landingPath: "/account/person@example.com",
      },
    }));

    expect(response.status).toBe(400);
    expect(persistenceMocks.persistPublicEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when a supplied product does not exist", async () => {
    persistenceMocks.persistPublicEvent.mockResolvedValue({
      accepted: false,
      reason: "invalid_product",
    });

    const response = await postEvent(requestFor(validProductViewed));

    expect(response.status).toBe(400);
  });

  it("returns 413 when content-length or the actual body exceeds 16 KB", async () => {
    const declaredLarge = await postEvent(requestFor(validProductViewed, {
      "content-length": "16385",
    }));
    const actualLarge = await postEvent(requestFor("x".repeat(16_385)));

    expect(declaredLarge.status).toBe(413);
    expect(actualLarge.status).toBe(413);
    expect(persistenceMocks.persistPublicEvent).not.toHaveBeenCalled();
  });

  it("parses JSON safely and hides persistence details", async () => {
    const malformed = await postEvent(requestFor("{"));
    persistenceMocks.persistPublicEvent.mockRejectedValue(new Error("secret database hostname"));
    const unavailable = await postEvent(requestFor(validProductViewed));

    expect(malformed.status).toBe(400);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("secret database hostname");
  });
});

describe("POST /api/growth/exposures", () => {
  const validExposure = {
    sessionId: "sess_000000000001",
    experiment: "related_product_ranking_v1",
    variant: "treatment",
    exposedAt: "2026-07-19T10:00:00.000Z",
    attribution: {
      utmSource: "google",
      landingPath: "/products",
      referrerCategory: "search",
    },
  };

  it("validates assignment and upserts a normalized exposure", async () => {
    const response = await postExposure(requestFor(validExposure));

    expect(response.status).toBe(202);
    expect(persistenceMocks.recordExposure).toHaveBeenCalledWith({
      ...validExposure,
      exposedAt: new Date("2026-07-19T10:00:00.000Z"),
    });
  });

  it("returns 400 for a mismatched variant or unknown attribution", async () => {
    const wrongVariant = await postExposure(requestFor({
      ...validExposure,
      variant: "control",
    }));
    const unknownAttribution = await postExposure(requestFor({
      ...validExposure,
      attribution: { ...validExposure.attribution, email: "hidden@example.com" },
    }));

    expect(wrongVariant.status).toBe(400);
    expect(unknownAttribution.status).toBe(400);
    expect(persistenceMocks.recordExposure).not.toHaveBeenCalled();
  });

  it("uses the same size and persistence failure conventions", async () => {
    const oversized = await postExposure(requestFor(validExposure, {
      "content-length": "16385",
    }));
    persistenceMocks.recordExposure.mockRejectedValue(new Error("secret database hostname"));
    const unavailable = await postExposure(requestFor(validExposure));

    expect(oversized.status).toBe(413);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("secret database hostname");
  });
});
