import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { GrowthDashboard } from "@/app/admin/growth/GrowthDashboard";
import { calculateExperimentResults } from "@/lib/growth/analytics";
import {
  emptyGrowthDashboardData,
  type GrowthDashboardData,
} from "@/lib/growth/queries";

function dashboardData(): GrowthDashboardData {
  const experiments = calculateExperimentResults([], []);
  experiments[0] = {
    ...experiments[0],
    variants: {
      control: {
        exposures: 80,
        conversions: 16,
        rate: 0.2,
        interval: { low: 0.13, high: 0.3 },
      },
      treatment: {
        exposures: 80,
        conversions: 20,
        rate: 0.25,
        interval: { low: 0.17, high: 0.36 },
      },
    },
    absoluteLift: 0.05,
    allocationBalance: { control: 0.5, treatment: 0.5 },
    evidence: "insufficient",
  };

  return {
    funnel: {
      stages: [
        { name: "product_viewed", sessions: 100, previousRate: 1, overallRate: 1 },
        { name: "add_to_cart", sessions: 45, previousRate: 0.45, overallRate: 0.45 },
        { name: "checkout_started", sessions: 30, previousRate: 2 / 3, overallRate: 0.3 },
        { name: "checkout_step_completed", sessions: 24, previousRate: 0.8, overallRate: 0.24 },
        { name: "order_completed", sessions: 18, previousRate: 0.75, overallRate: 0.18 },
      ],
    },
    experiments,
    acquisition: [{ source: "google", campaign: "summer", sessions: 42 }],
    includesDemo: true,
    window: {
      start: new Date("2026-06-22T12:00:00.000Z"),
      end: new Date("2026-07-22T12:00:00.000Z"),
      days: 30,
    },
  };
}

describe("GrowthDashboard", () => {
  it("builds a complete zero-safe dashboard result for database failures", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");

    const data = emptyGrowthDashboardData(now);

    expect(data.funnel.stages).toHaveLength(5);
    expect(data.funnel.stages.every((stage) => stage.sessions === 0)).toBe(true);
    expect(data.experiments).toHaveLength(2);
    expect(data.acquisition).toEqual([]);
    expect(data.includesDemo).toBe(false);
    expect(data.window).toEqual({
      start: new Date("2026-06-22T12:00:00.000Z"),
      end: now,
      days: 30,
    });
  });

  it("renders recruiter-readable funnel, acquisition, and experiment evidence", () => {
    const html = renderToStaticMarkup(createElement(GrowthDashboard, { data: dashboardData() }));

    expect(html).toContain("Growth analytics");
    expect(html).toContain("Last 30 days");
    expect(html).toContain("Seeded demo data");
    expect(html).toContain("Product viewed");
    expect(html).toContain("45.0%");
    expect(html).toContain("google");
    expect(html).toContain("summer");
    expect(html).toContain("Checkout reassurance");
    expect(html).toContain("Related product ranking");
    expect(html).toContain("Recommendation add-to-cart conversion");
    expect(html).toContain("Exposures");
    expect(html).toContain("Conversions");
    expect(html).toContain("25.0%");
    expect(html).toContain("+5.0 pp");
    expect(html).toContain("50.0% / 50.0%");
    expect(html).toContain("17.0%\u201336.0%");
    expect(html).toContain("Insufficient evidence \u2014 directional only");
    expect(html).toContain("Limitations");
    expect(html).not.toMatch(/winner|loser/i);
  });

  it("renders explicit database and acquisition empty states", () => {
    const data = { ...dashboardData(), acquisition: [], includesDemo: false };
    const html = renderToStaticMarkup(createElement(GrowthDashboard, {
      data,
      dbError: "Growth analytics are unavailable. Check DATABASE_URL and run the seed.",
    }));

    expect(html).toContain("Analytics database unavailable");
    expect(html).toContain("Growth analytics are unavailable. Check DATABASE_URL and run the seed.");
    expect(html).toContain("No acquisition sessions in this window.");
    expect(html).not.toContain("Seeded demo data");
  });
});
