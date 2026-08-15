"use client";

import { useEffect } from "react";
import { useGrowth } from "@/lib/growth/GrowthProvider";
import type { ExperimentKey } from "@/lib/growth/experiments";

export function ExperimentExposure({ experiment }: { experiment: ExperimentKey }) {
  const { ready, expose } = useGrowth();

  useEffect(() => {
    if (ready) expose(experiment);
  }, [experiment, expose, ready]);

  return null;
}
