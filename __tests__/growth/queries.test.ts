import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: {
    growthEvent: { findMany: vi.fn() },
    experimentExposure: { findMany: vi.fn() },
    growthSession: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { getGrowthDashboardData } from "@/lib/growth/queries";

const now = new Date("2026-07-22T12:00:00.000Z");
const windowStart = new Date("2026-06-22T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  authMock.mockResolvedValue({ user: { role: "admin" } });
  prismaMock.growthEvent.findMany.mockResolvedValue([]);
  prismaMock.experimentExposure.findMany.mockResolvedValue([]);
  prismaMock.growthSession.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getGrowthDashboardData", () => {
  it.each([
    ["staff", { user: { role: "staff" } }],
    ["anonymous", null],
  ])("rejects %s sessions before querying growth rows", async (_label, session) => {
    authMock.mockResolvedValue(session);

    await expect(getGrowthDashboardData()).rejects.toThrow("Admin only");

    expect(prismaMock.growthEvent.findMany).not.toHaveBeenCalled();
    expect(prismaMock.experimentExposure.findMany).not.toHaveBeenCalled();
    expect(prismaMock.growthSession.findMany).not.toHaveBeenCalled();
  });

  it("loads events, exposures, and first-touch attribution for a documented 30-day window", async () => {
    await getGrowthDashboardData();

    expect(authMock).toHaveBeenCalledOnce();
    expect(prismaMock.growthEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { receivedAt: { gte: windowStart, lte: now } },
      select: expect.objectContaining({ receivedAt: true, placement: true }),
    }));
    expect(prismaMock.experimentExposure.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { receivedAt: { gte: windowStart, lte: now } },
      select: expect.objectContaining({ receivedAt: true }),
    }));
    expect(prismaMock.growthSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { firstSeenAt: { gte: windowStart, lte: now } },
    }));
  });

  it("returns calculated results, acquisition groups, explicit demo state, and window metadata", async () => {
    prismaMock.growthEvent.findMany.mockResolvedValue([
      {
        sessionId: "s1",
        name: "product_viewed",
        receivedAt: new Date("2026-07-20T12:00:00.000Z"),
        placement: "direct",
        demo: false,
      },
      {
        sessionId: "s2",
        name: "product_viewed",
        receivedAt: new Date("2026-07-20T12:00:00.000Z"),
        placement: "direct",
        demo: true,
      },
    ]);
    prismaMock.growthSession.findMany.mockResolvedValue([
      { id: "s1", utmSource: "google", utmCampaign: "summer", referrerCategory: "search", demo: false },
      { id: "s2", utmSource: "google", utmCampaign: "summer", referrerCategory: "search", demo: false },
      { id: "s3", utmSource: null, utmCampaign: null, referrerCategory: "direct", demo: false },
    ]);

    const result = await getGrowthDashboardData();

    expect(result.funnel.stages[0]).toMatchObject({ name: "product_viewed", sessions: 2 });
    expect(result.experiments).toHaveLength(2);
    expect(result.acquisition).toEqual([
      { source: "google", campaign: "summer", sessions: 2 },
      { source: "direct", campaign: null, sessions: 1 },
    ]);
    expect(result.includesDemo).toBe(true);
    expect(result.window).toEqual({ start: windowStart, end: now, days: 30 });
  });

  it("uses demo flags instead of inferring demo data from acquisition names", async () => {
    prismaMock.growthSession.findMany.mockResolvedValue([
      {
        id: "s1",
        utmSource: "demo-campaign",
        utmCampaign: "seeded-demo",
        referrerCategory: "referral",
        demo: false,
      },
    ]);

    await expect(getGrowthDashboardData()).resolves.toMatchObject({ includesDemo: false });
  });

  it("logs database details server-side but exposes only a generic query error", async () => {
    const databaseError = new Error("postgresql://secret-host/internal-table");
    prismaMock.growthEvent.findMany.mockRejectedValue(databaseError);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const request = getGrowthDashboardData();
    await expect(request).rejects.toThrow("Growth analytics unavailable");
    await expect(request).rejects.not.toThrow("secret-host");
    expect(errorSpy).toHaveBeenCalledWith("Growth dashboard query failed", databaseError);

    errorSpy.mockRestore();
  });
});
