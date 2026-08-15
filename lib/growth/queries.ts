import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  calculateExperimentResults,
  calculateFunnel,
  type ExperimentResult,
  type FunnelResult,
} from "@/lib/growth/analytics";

// All dashboard metrics use the same inclusive rolling UTC window.
export const GROWTH_WINDOW_DAYS = 30;

export type AcquisitionResult = {
  source: string;
  campaign: string | null;
  sessions: number;
};

export type GrowthDashboardData = {
  funnel: FunnelResult;
  experiments: ExperimentResult[];
  acquisition: AcquisitionResult[];
  includesDemo: boolean;
  window: {
    start: Date;
    end: Date;
    days: typeof GROWTH_WINDOW_DAYS;
  };
};

type AttributionRow = {
  utmSource: string | null;
  utmCampaign: string | null;
  referrerCategory: string | null;
};

export function emptyGrowthDashboardData(
  end = new Date(),
): GrowthDashboardData {
  const start = new Date(end.getTime() - GROWTH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return {
    funnel: calculateFunnel([]),
    experiments: calculateExperimentResults([], []),
    acquisition: [],
    includesDemo: false,
    window: { start, end, days: GROWTH_WINDOW_DAYS },
  };
}

function calculateAcquisition(rows: AttributionRow[]): AcquisitionResult[] {
  const grouped = new Map<string, AcquisitionResult>();

  for (const row of rows) {
    const source = row.utmSource ?? row.referrerCategory ?? "direct";
    const campaign = row.utmCampaign;
    const key = JSON.stringify([source, campaign]);
    const current = grouped.get(key);
    if (current) {
      current.sessions += 1;
    } else {
      grouped.set(key, { source, campaign, sessions: 1 });
    }
  }

  return [...grouped.values()].sort((left, right) =>
    right.sessions - left.sessions
    || left.source.localeCompare(right.source)
    || (left.campaign ?? "").localeCompare(right.campaign ?? ""));
}

export async function getGrowthDashboardData(): Promise<GrowthDashboardData> {
  const session = await auth();
  if (session?.user?.role !== "admin") throw new Error("Admin only");

  const end = new Date();
  const start = new Date(end.getTime() - GROWTH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  try {
    const [events, exposures, sessions] = await Promise.all([
      prisma.growthEvent.findMany({
        where: { receivedAt: { gte: start, lte: end } },
        select: {
          sessionId: true,
          name: true,
          receivedAt: true,
          placement: true,
          demo: true,
        },
      }),
      prisma.experimentExposure.findMany({
        where: { receivedAt: { gte: start, lte: end } },
        select: {
          sessionId: true,
          experiment: true,
          version: true,
          variant: true,
          receivedAt: true,
          demo: true,
        },
      }),
      prisma.growthSession.findMany({
        where: { firstSeenAt: { gte: start, lte: end } },
        select: {
          id: true,
          utmSource: true,
          utmCampaign: true,
          referrerCategory: true,
          demo: true,
        },
      }),
    ]);

    return {
      funnel: calculateFunnel(events),
      experiments: calculateExperimentResults(exposures, events),
      acquisition: calculateAcquisition(sessions),
      includesDemo: events.some((row) => row.demo)
        || exposures.some((row) => row.demo)
        || sessions.some((row) => row.demo),
      window: { start, end, days: GROWTH_WINDOW_DAYS },
    };
  } catch (error) {
    console.error("Growth dashboard query failed", error);
    throw new Error("Growth analytics unavailable");
  }
}
