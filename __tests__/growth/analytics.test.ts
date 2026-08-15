import { describe, expect, it } from "vitest";
import {
  calculateExperimentResults,
  calculateFunnel,
  wilsonInterval,
} from "@/lib/growth/analytics";

function event(
  sessionId: string,
  name: string,
  receivedAt = "2026-07-01T12:00:00.000Z",
  placement?: string,
) {
  return { sessionId, name, receivedAt: new Date(receivedAt), placement };
}

function exposure(
  sessionId: string,
  variant: "control" | "treatment",
  receivedAt = "2026-07-01T12:00:00.000Z",
  experiment = "checkout_reassurance_v1",
) {
  return {
    sessionId,
    experiment,
    version: 1,
    variant,
    receivedAt: new Date(receivedAt),
  };
}

describe("calculateFunnel", () => {
  it("counts each session once per funnel stage", () => {
    const result = calculateFunnel([
      event("s1", "product_viewed"),
      event("s1", "product_viewed"),
      event("s1", "add_to_cart"),
      event("s2", "product_viewed"),
    ]);

    expect(result.stages).toEqual([
      expect.objectContaining({ name: "product_viewed", sessions: 2 }),
      expect.objectContaining({ name: "add_to_cart", sessions: 1, previousRate: 0.5 }),
      expect.objectContaining({ name: "checkout_started", sessions: 0, previousRate: 0 }),
      expect.objectContaining({ name: "checkout_step_completed", sessions: 0 }),
      expect.objectContaining({ name: "order_completed", sessions: 0 }),
    ]);
  });

  it("reports step-to-step and first-stage rates without dividing by zero", () => {
    const result = calculateFunnel([
      event("s1", "product_viewed"),
      event("s2", "product_viewed"),
      event("s1", "add_to_cart"),
      event("s1", "checkout_started"),
    ]);

    expect(result.stages[0]).toMatchObject({ previousRate: 1, overallRate: 1 });
    expect(result.stages[2]).toMatchObject({ previousRate: 1, overallRate: 0.5 });
    expect(calculateFunnel([]).stages.every((stage) =>
      stage.previousRate === 0 && stage.overallRate === 0)).toBe(true);
  });
});

describe("wilsonInterval", () => {
  it("returns a bounded descriptive 95% interval", () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 0 });
    expect(wilsonInterval(50, 100)).toEqual({
      low: expect.closeTo(0.4038, 3),
      high: expect.closeTo(0.5962, 3),
    });
  });
});

describe("calculateExperimentResults", () => {
  it("attributes only conversions at or after first exposure", () => {
    const exposures = [
      exposure("s1", "treatment", "2026-07-01T12:00:00.000Z"),
      exposure("s2", "treatment", "2026-07-01T12:00:00.000Z"),
    ];

    const result = calculateExperimentResults(exposures, [
      event("s1", "order_completed", "2026-07-01T11:59:59.000Z"),
      event("s1", "order_completed", "2026-07-01T12:00:00.000Z"),
      event("s1", "order_completed", "2026-07-01T13:00:00.000Z"),
      event("s2", "checkout_started", "2026-07-01T13:00:00.000Z"),
    ]);

    expect(result[0].variants.treatment).toMatchObject({
      exposures: 2,
      conversions: 1,
      rate: 0.5,
    });
  });

  it("uses the earliest exposure once per session and experiment", () => {
    const result = calculateExperimentResults([
      exposure("s1", "treatment", "2026-07-02T12:00:00.000Z"),
      exposure("s1", "control", "2026-07-01T12:00:00.000Z"),
    ], [event("s1", "order_completed", "2026-07-01T13:00:00.000Z")]);

    expect(result[0].variants.control).toMatchObject({ exposures: 1, conversions: 1 });
    expect(result[0].variants.treatment).toMatchObject({ exposures: 0, conversions: 0 });
  });

  it.each(
    [
      ["checkout_reassurance_v1", "order_completed", undefined],
      ["related_product_ranking_v1", "add_to_cart", "recommendation"],
    ] satisfies Array<[string, string, string | undefined]>,
  )("uses the registry conversion event for %s", (experiment, conversionEvent, placement) => {
    const result = calculateExperimentResults([
      exposure("s1", "treatment", undefined, experiment),
    ], [event("s1", conversionEvent, undefined, placement)]).find(({ key }) => key === experiment)!;

    expect(result.conversionEvent).toBe(conversionEvent);
    expect(result.variants.treatment.conversions).toBe(1);
  });

  it("counts only recommendation add-to-cart events for related-product ranking", () => {
    const result = calculateExperimentResults([
      exposure("recommendation", "treatment", undefined, "related_product_ranking_v1"),
      exposure("pdp", "treatment", undefined, "related_product_ranking_v1"),
      exposure("listing", "treatment", undefined, "related_product_ranking_v1"),
    ], [
      event("recommendation", "add_to_cart", undefined, "recommendation"),
      event("pdp", "add_to_cart", undefined, "pdp"),
      event("listing", "add_to_cart", undefined, "listing"),
    ]).find(({ key }) => key === "related_product_ranking_v1")!;

    expect(result.variants.treatment).toMatchObject({ exposures: 3, conversions: 1 });
  });

  it("uses server-received chronology for post-exposure attribution", () => {
    const result = calculateExperimentResults([
      exposure("before", "treatment", "2026-07-01T12:00:00.000Z"),
      exposure("after", "treatment", "2026-07-01T12:00:00.000Z"),
    ], [
      event("before", "order_completed", "2026-07-01T11:59:59.000Z"),
      event("after", "order_completed", "2026-07-01T12:00:01.000Z"),
    ]).find(({ key }) => key === "checkout_reassurance_v1")!;

    expect(result.variants.treatment).toMatchObject({ exposures: 2, conversions: 1 });
  });

  it("reports lift, allocation balance, and no winner claim", () => {
    const results = calculateExperimentResults([
      exposure("c1", "control", undefined, "related_product_ranking_v1"),
      exposure("t1", "treatment", undefined, "related_product_ranking_v1"),
      exposure("t2", "treatment", undefined, "related_product_ranking_v1"),
    ], [
      // related_product_ranking_v1 only counts add-to-cart from the
      // recommendation placement, so t2's event must not convert.
      event("c1", "add_to_cart", undefined, "recommendation"),
      event("t1", "add_to_cart", undefined, "recommendation"),
      event("t2", "add_to_cart", undefined, "pdp"),
    ]);
    const result = results.find(({ key }) => key === "related_product_ranking_v1")!;

    expect(result.variants.control.rate).toBe(1);
    expect(result.variants.treatment.rate).toBe(0.5);
    expect(result.absoluteLift).toBe(-0.5);
    expect(result.allocationBalance).toEqual({ control: 1 / 3, treatment: 2 / 3 });
    expect(result).not.toHaveProperty("winner");
  });

  it("marks fewer than 100 sessions per variant as insufficient", () => {
    const smallSampleExposures = [
      exposure("c1", "control"),
      exposure("t1", "treatment"),
    ];

    expect(calculateExperimentResults(smallSampleExposures, []).at(0)?.evidence)
      .toBe("insufficient");
  });

  it("uses a descriptive evidence label once both variants reach 100 sessions", () => {
    const exposures = Array.from({ length: 200 }, (_, index) =>
      exposure(`s${index}`, index < 100 ? "control" : "treatment"));

    expect(calculateExperimentResults(exposures, [])[0].evidence).toBe("descriptive");
  });
});
