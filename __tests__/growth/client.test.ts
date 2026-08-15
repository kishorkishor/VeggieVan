import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coarsenLandingPath,
  getGrowthIdentity,
  trackExposure,
  trackGrowthEvent,
} from "@/lib/growth/client";

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("getGrowthIdentity", () => {
  it("coarsens arbitrary paths without retaining private segments", () => {
    expect(coarsenLandingPath("/account/person@example.com")).toBe("/other");
    expect(coarsenLandingPath("/products/person@example.com")).toBe("/products/:slug");
    expect(coarsenLandingPath("/products/fresh-tomatoes")).toBe("/products/:slug");
    expect(coarsenLandingPath("/products/fresh-tomatoes/reviews")).toBe("/other");
  });

  it("keeps the generated opaque session id and only allowlisted campaign values", () => {
    history.replaceState(
      {},
      "",
      "/products?utm_source=google&utm_campaign=spring&email=hidden@example.com",
    );

    const identity = getGrowthIdentity();

    expect(identity.sessionId).toMatch(/^sess_[a-f0-9-]{36}$/);
    expect(identity.attribution).toEqual(expect.objectContaining({
      utmSource: "google",
      utmCampaign: "spring",
      landingPath: "/products",
    }));
    expect(JSON.stringify(identity)).not.toContain("hidden@example.com");
  });

  it("persists the original identity and first-touch attribution", () => {
    history.replaceState({}, "", "/products?utm_source=google&utm_campaign=spring");
    const first = getGrowthIdentity();

    history.replaceState({}, "", "/checkout?utm_source=social&utm_campaign=later");
    const second = getGrowthIdentity();

    expect(second).toEqual(first);
    expect(second.attribution.utmSource).toBe("google");
    expect(second.attribution.landingPath).toBe("/products");
  });

  it("omits campaign values that do not satisfy the server allowlist", () => {
    history.replaceState(
      {},
      "",
      "/products?utm_source=person%40example.com&utm_medium=paid-search",
    );

    const identity = getGrowthIdentity();

    expect(identity.attribution).not.toHaveProperty("utmSource");
    expect(identity.attribution.utmMedium).toBe("paid-search");
  });

  it("keeps one in-memory identity when session storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    const first = getGrowthIdentity();
    const second = getGrowthIdentity();

    expect(second).toEqual(first);
    expect(second.sessionId).toMatch(/^sess_[a-f0-9-]{36}$/);
  });

  it("keeps the fallback when storage reads work but writes are disabled", () => {
    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is read-only");
    });

    const first = getGrowthIdentity();
    const second = getGrowthIdentity();

    expect(second).toEqual(first);
    expect(second.sessionId).toBe(first.sessionId);
  });
});

describe("growth transport", () => {
  const event = {
    eventId: "evt_000000000001",
    sessionId: "sess_000000000001",
    occurredAt: "2026-07-19T10:00:00.000Z",
    name: "checkout_started" as const,
    properties: { cartValue: 1098, cartSize: 2 },
  };

  it("posts events once with keepalive to the fixed event endpoint", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 202 }));

    trackGrowthEvent(event);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/growth/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
  });

  it("posts exposures once with keepalive to the fixed exposure endpoint", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 202 }));
    const exposure = {
      sessionId: "sess_000000000001",
      experiment: "related_product_ranking_v1" as const,
      variant: "treatment" as const,
      exposedAt: "2026-07-19T10:00:00.000Z",
    };

    trackExposure(exposure);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/growth/exposures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(exposure),
      keepalive: true,
    });
  });

  it("swallows transport errors without a synchronous retry", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    expect(() => trackGrowthEvent(event)).not.toThrow();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
