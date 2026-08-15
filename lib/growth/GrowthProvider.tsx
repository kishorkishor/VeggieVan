"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getGrowthIdentity,
  trackExposure,
  trackGrowthEvent,
  type GrowthIdentity,
} from "@/lib/growth/client";
import type { ExperimentKey, Variant } from "@/lib/growth/experiments";
import {
  createGrowthEvent,
  initializeGrowth,
  type GrowthAssignments,
  type PublicGrowthEventInput,
} from "@/lib/growth/provider";

type GrowthContextValue = {
  ready: boolean;
  growth?: {
    sessionId: string;
    experiments: GrowthAssignments;
  };
  variant: (key: ExperimentKey) => Variant;
  expose: (key: ExperimentKey) => void;
  track: (event: PublicGrowthEventInput) => void;
};

type GrowthRuntime = {
  identity: GrowthIdentity;
  assignments: GrowthAssignments;
};

const GrowthContext = createContext<GrowthContextValue | undefined>(undefined);

export function GrowthProvider({ children }: { children: React.ReactNode }) {
  const [runtime, setRuntime] = useState<GrowthRuntime>();
  const exposed = useRef(new Set<ExperimentKey>());

  useEffect(() => {
    try {
      const identity = getGrowthIdentity();
      const initialized = initializeGrowth(identity.sessionId, sessionStorage);
      setRuntime({ identity, assignments: initialized.assignments });
    } catch {
      // Analytics initialization is fail-open and never gates the storefront.
    }
  }, []);

  const variant = useCallback((key: ExperimentKey): Variant => (
    runtime?.assignments[key] ?? "control"
  ), [runtime]);

  const expose = useCallback((key: ExperimentKey) => {
    if (!runtime || exposed.current.has(key)) return;
    exposed.current.add(key);
    trackExposure({
      sessionId: runtime.identity.sessionId,
      experiment: key,
      variant: runtime.assignments[key],
      exposedAt: new Date().toISOString(),
      attribution: runtime.identity.attribution,
    });
  }, [runtime]);

  const track = useCallback((event: PublicGrowthEventInput) => {
    if (!runtime) return;
    try {
      trackGrowthEvent(createGrowthEvent(
        event,
        {
          sessionId: runtime.identity.sessionId,
          assignments: runtime.assignments,
          attribution: runtime.identity.attribution,
        },
        {
          eventId: `evt_${crypto.randomUUID()}`,
          occurredAt: new Date().toISOString(),
        },
      ));
    } catch {
      // Invalid analytics input cannot interrupt a shopper action.
    }
  }, [runtime]);

  const value = useMemo<GrowthContextValue>(() => ({
    ready: runtime !== undefined,
    growth: runtime && {
      sessionId: runtime.identity.sessionId,
      experiments: runtime.assignments,
    },
    variant,
    expose,
    track,
  }), [runtime, variant, expose, track]);

  return <GrowthContext.Provider value={value}>{children}</GrowthContext.Provider>;
}

export function useGrowth(): GrowthContextValue {
  const value = useContext(GrowthContext);
  if (!value) throw new Error("useGrowth must be used within GrowthProvider");
  return value;
}
