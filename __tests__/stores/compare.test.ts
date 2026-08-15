import { describe, it, expect, beforeEach } from "vitest";
import { useCompare } from "@/lib/stores";

beforeEach(() => {
  useCompare.setState({ ids: [] });
  localStorage.clear();
});

describe("useCompare", () => {
  it("starts empty", () => {
    expect(useCompare.getState().ids).toEqual([]);
  });

  it("toggle adds an id", () => {
    useCompare.getState().toggle("p01");
    expect(useCompare.getState().ids).toContain("p01");
  });

  it("toggle removes an id that already exists", () => {
    useCompare.getState().toggle("p01");
    useCompare.getState().toggle("p01");
    expect(useCompare.getState().ids).not.toContain("p01");
  });

  it("has() returns correct boolean", () => {
    useCompare.getState().toggle("p01");
    expect(useCompare.getState().has("p01")).toBe(true);
    expect(useCompare.getState().has("p02")).toBe(false);
  });

  it("caps at 4 items — 5th toggle is a no-op", () => {
    ["p01", "p02", "p03", "p04"].forEach((id) => useCompare.getState().toggle(id));
    useCompare.getState().toggle("p05");
    expect(useCompare.getState().ids).toHaveLength(4);
    expect(useCompare.getState().ids).not.toContain("p05");
  });

  it("toggling an existing id when at capacity removes it", () => {
    ["p01", "p02", "p03", "p04"].forEach((id) => useCompare.getState().toggle(id));
    useCompare.getState().toggle("p01");
    expect(useCompare.getState().ids).toHaveLength(3);
    expect(useCompare.getState().ids).not.toContain("p01");
  });

  it("remove removes a specific id", () => {
    useCompare.getState().toggle("p01");
    useCompare.getState().toggle("p02");
    useCompare.getState().remove("p01");
    const { ids } = useCompare.getState();
    expect(ids).not.toContain("p01");
    expect(ids).toContain("p02");
  });

  it("clear removes all ids", () => {
    ["p01", "p02", "p03"].forEach((id) => useCompare.getState().toggle(id));
    useCompare.getState().clear();
    expect(useCompare.getState().ids).toEqual([]);
  });
});
