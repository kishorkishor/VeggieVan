import type { GrowthIdentity } from "@/lib/growth/client";
import {
  assignVariant,
  EXPERIMENTS,
  type ExperimentKey,
  type Variant,
} from "@/lib/growth/experiments";
import { publicGrowthEventSchema, type PublicGrowthEvent } from "@/lib/growth/schema";

export const ASSIGNMENTS_STORAGE_KEY = "veggievan-growth-assignments-v1";

export type GrowthAssignments = Record<ExperimentKey, Variant>;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

type EventInput<Event extends PublicGrowthEvent = PublicGrowthEvent> = Event extends PublicGrowthEvent
  ? Pick<Event, "name" | "properties">
  : never;

export type PublicGrowthEventInput = EventInput;

export type InitializedGrowth = {
  sessionId: string;
  assignments: GrowthAssignments;
};

function assignedVariants(sessionId: string): GrowthAssignments {
  return Object.fromEntries(
    (Object.keys(EXPERIMENTS) as ExperimentKey[]).map((key) => [
      key,
      assignVariant(sessionId, key),
    ]),
  ) as GrowthAssignments;
}

function matches(assignments: unknown, expected: GrowthAssignments): assignments is GrowthAssignments {
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) return false;
  const record = assignments as Record<string, unknown>;
  const keys = Object.keys(EXPERIMENTS) as ExperimentKey[];
  return Object.keys(record).length === keys.length
    && keys.every((key) => record[key] === expected[key]);
}

export function initializeGrowth(sessionId: string, storage: StorageLike): InitializedGrowth {
  const expected = assignedVariants(sessionId);
  try {
    const stored = storage.getItem(ASSIGNMENTS_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (matches(parsed, expected)) return { sessionId, assignments: parsed };
    }
  } catch {
    // Assignment persistence is fail-open.
  }

  try {
    storage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(expected));
  } catch {
    // The deterministic assignments remain valid in memory when storage fails.
  }
  return { sessionId, assignments: expected };
}

export function createGrowthEvent(
  input: PublicGrowthEventInput,
  context: {
    sessionId: string;
    assignments: GrowthAssignments;
    attribution: GrowthIdentity["attribution"];
  },
  metadata: { eventId: string; occurredAt: string },
): PublicGrowthEvent {
  return publicGrowthEventSchema.parse({
    ...metadata,
    ...input,
    sessionId: context.sessionId,
    experiments: context.assignments,
    attribution: context.attribution,
  });
}
