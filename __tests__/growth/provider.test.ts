import { describe, expect, it } from "vitest";
import { EXPERIMENTS } from "@/lib/growth/experiments";
import {
  ASSIGNMENTS_STORAGE_KEY,
  createGrowthEvent,
  initializeGrowth,
} from "@/lib/growth/provider";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("initializeGrowth", () => {
  it("persists assigned variants for every registered experiment", () => {
    const storage = new MemoryStorage();

    const first = initializeGrowth("sess_000000000001", storage);
    const second = initializeGrowth("sess_000000000001", storage);

    expect(second.assignments).toEqual(first.assignments);
    expect(Object.keys(second.assignments)).toEqual(Object.keys(EXPERIMENTS));
    expect(JSON.parse(storage.getItem(ASSIGNMENTS_STORAGE_KEY)!)).toEqual(first.assignments);
  });

  it("replaces stored assignments that do not match the current session", () => {
    const storage = new MemoryStorage();
    storage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify({
      checkout_reassurance_v1: "treatment",
      free_shipping_progress_v1: "treatment",
      related_product_ranking_v1: "treatment",
    }));

    const initialized = initializeGrowth("sess_000000000001", storage);

    expect(initialized.assignments).not.toEqual({
      checkout_reassurance_v1: "treatment",
      free_shipping_progress_v1: "treatment",
      related_product_ranking_v1: "treatment",
    });
    expect(JSON.parse(storage.getItem(ASSIGNMENTS_STORAGE_KEY)!)).toEqual(initialized.assignments);
  });

  it("remains usable when assignment storage is unavailable", () => {
    const storage = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
    };

    expect(() => initializeGrowth("sess_000000000001", storage)).not.toThrow();
    expect(Object.keys(initializeGrowth("sess_000000000001", storage).assignments))
      .toEqual(Object.keys(EXPERIMENTS));
  });
});

describe("createGrowthEvent", () => {
  it("attaches identity, persisted assignments, attribution, time, and event id", () => {
    const initialized = initializeGrowth("sess_000000000001", new MemoryStorage());

    const event = createGrowthEvent(
      {
        name: "checkout_started",
        properties: { cartValue: 1098, cartSize: 2 },
      },
      {
        sessionId: initialized.sessionId,
        assignments: initialized.assignments,
        attribution: { landingPath: "/checkout", referrerCategory: "internal" },
      },
      {
        eventId: "evt_000000000001",
        occurredAt: "2026-07-19T10:00:00.000Z",
      },
    );

    expect(event).toEqual({
      eventId: "evt_000000000001",
      sessionId: "sess_000000000001",
      occurredAt: "2026-07-19T10:00:00.000Z",
      name: "checkout_started",
      properties: { cartValue: 1098, cartSize: 2 },
      experiments: initialized.assignments,
      attribution: { landingPath: "/checkout", referrerCategory: "internal" },
    });
  });
});
