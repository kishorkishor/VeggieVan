import { describe, expect, it } from "vitest";
import { assignVariant, EXPERIMENTS } from "@/lib/growth/experiments";

describe("assignVariant", () => {
  it("is stable for the same session and experiment", () => {
    expect(assignVariant("sess_000000000001", "checkout_reassurance_v1"))
      .toBe(assignVariant("sess_000000000001", "checkout_reassurance_v1"));
  });

  it("keeps every assignment inside the registered variants", () => {
    for (const key of Object.keys(EXPERIMENTS) as (keyof typeof EXPERIMENTS)[]) {
      expect(EXPERIMENTS[key].variants).toContain(assignVariant("sess_000000000002", key));
    }
  });

  it("produces both buckets across a deterministic sample", () => {
    const variants = new Set(Array.from({ length: 200 }, (_, index) =>
      assignVariant(`sess_${index.toString().padStart(12, "0")}`, "related_product_ranking_v1")));
    expect(variants).toEqual(new Set(["control", "treatment"]));
  });
});
