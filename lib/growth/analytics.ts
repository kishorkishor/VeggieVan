import {
  EXPERIMENTS,
  type ExperimentKey,
  type Variant,
} from "@/lib/growth/experiments";

const FUNNEL_STAGES = [
  "product_viewed",
  "add_to_cart",
  "checkout_started",
  "checkout_step_completed",
  "order_completed",
] as const;

type FunnelStageName = (typeof FUNNEL_STAGES)[number];

export type AnalyticsEvent = {
  sessionId: string;
  name: string;
  receivedAt: Date;
  placement?: string | null;
};

export type AnalyticsExposure = {
  sessionId: string;
  experiment: string;
  version: number;
  variant: string;
  receivedAt: Date;
};

export type FunnelResult = {
  stages: Array<{
    name: FunnelStageName;
    sessions: number;
    previousRate: number;
    overallRate: number;
  }>;
};

export type WilsonInterval = { low: number; high: number };

type VariantResult = {
  exposures: number;
  conversions: number;
  rate: number;
  interval: WilsonInterval;
};

export type ExperimentResult = {
  key: ExperimentKey;
  version: number;
  conversionEvent: string;
  variants: Record<Variant, VariantResult>;
  absoluteLift: number;
  allocationBalance: Record<Variant, number>;
  evidence: "insufficient" | "descriptive";
};

function rate(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function calculateFunnel(rows: AnalyticsEvent[]): FunnelResult {
  const sessionsByStage = new Map<FunnelStageName, Set<string>>(
    FUNNEL_STAGES.map((stage) => [stage, new Set<string>()]),
  );

  for (const row of rows) {
    if (FUNNEL_STAGES.includes(row.name as FunnelStageName)) {
      sessionsByStage.get(row.name as FunnelStageName)!.add(row.sessionId);
    }
  }

  const firstStageSessions = sessionsByStage.get(FUNNEL_STAGES[0])!.size;
  return {
    stages: FUNNEL_STAGES.map((name, index) => {
      const sessions = sessionsByStage.get(name)!.size;
      const previousSessions = index === 0
        ? sessions
        : sessionsByStage.get(FUNNEL_STAGES[index - 1])!.size;
      return {
        name,
        sessions,
        previousRate: rate(sessions, previousSessions),
        overallRate: rate(sessions, firstStageSessions),
      };
    }),
  };
}

export function wilsonInterval(successes: number, total: number): WilsonInterval {
  if (total === 0) return { low: 0, high: 0 };

  const z = 1.96;
  const observed = successes / total;
  const denominator = 1 + (z ** 2) / total;
  const center = (observed + (z ** 2) / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt(
    (observed * (1 - observed)) / total + (z ** 2) / (4 * total ** 2),
  );

  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function emptyVariantResult(): VariantResult {
  return { exposures: 0, conversions: 0, rate: 0, interval: { low: 0, high: 0 } };
}

export function calculateExperimentResults(
  exposures: AnalyticsExposure[],
  events: AnalyticsEvent[],
): ExperimentResult[] {
  const latestConversionByExperimentAndSession = new Map<
    ExperimentKey,
    Map<string, Date>
  >();
  for (const event of events) {
    for (const key of Object.keys(EXPERIMENTS) as ExperimentKey[]) {
      const definition = EXPERIMENTS[key];
      const isRecommendationConversion = key !== "related_product_ranking_v1"
        || event.placement === "recommendation";
      if (event.name !== definition.conversionEvent || !isRecommendationConversion) continue;

      let bySession = latestConversionByExperimentAndSession.get(key);
      if (!bySession) {
        bySession = new Map<string, Date>();
        latestConversionByExperimentAndSession.set(key, bySession);
      }
      const current = bySession.get(event.sessionId);
      if (!current || event.receivedAt > current) {
        bySession.set(event.sessionId, event.receivedAt);
      }
    }
  }

  return (Object.keys(EXPERIMENTS) as ExperimentKey[]).map((key) => {
    const definition = EXPERIMENTS[key];
    const firstExposureBySession = new Map<string, AnalyticsExposure>();

    for (const exposure of exposures) {
      if (exposure.experiment !== key || exposure.version !== definition.version) continue;
      if (!definition.variants.includes(exposure.variant as Variant)) continue;
      const current = firstExposureBySession.get(exposure.sessionId);
      if (!current || exposure.receivedAt < current.receivedAt) {
        firstExposureBySession.set(exposure.sessionId, exposure);
      }
    }

    const variants: Record<Variant, VariantResult> = {
      control: emptyVariantResult(),
      treatment: emptyVariantResult(),
    };

    for (const exposure of firstExposureBySession.values()) {
      const variant = exposure.variant as Variant;
      variants[variant].exposures += 1;
      const latestConversion = latestConversionByExperimentAndSession
        .get(key)
        ?.get(exposure.sessionId);
      if (latestConversion && latestConversion >= exposure.receivedAt) {
        variants[variant].conversions += 1;
      }
    }

    for (const variant of definition.variants) {
      const result = variants[variant];
      result.rate = rate(result.conversions, result.exposures);
      result.interval = wilsonInterval(result.conversions, result.exposures);
    }

    const totalExposures = variants.control.exposures + variants.treatment.exposures;
    return {
      key,
      version: definition.version,
      conversionEvent: definition.conversionEvent,
      variants,
      absoluteLift: variants.treatment.rate - variants.control.rate,
      allocationBalance: {
        control: rate(variants.control.exposures, totalExposures),
        treatment: rate(variants.treatment.exposures, totalExposures),
      },
      evidence: variants.control.exposures < 100 || variants.treatment.exposures < 100
        ? "insufficient"
        : "descriptive",
    };
  });
}
