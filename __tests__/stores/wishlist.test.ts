import { describe, it, expect, beforeEach } from "vitest";
import { useWishlist } from "@/lib/stores";

beforeEach(() => {
  useWishlist.setState({ ids: [] });
  localStorage.clear();
});

describe("useWishlist", () => {
  it("starts empty", () => {
    expect(useWishlist.getState().ids).toEqual([]);
  });

  it("toggle adds an id", () => {
    useWishlist.getState().toggle("p01");
    expect(useWishlist.getState().ids).toContain("p01");
  });

  it("toggle removes an id that already exists", () => {
    useWishlist.getState().toggle("p01");
    useWishlist.getState().toggle("p01");
    expect(useWishlist.getState().ids).not.toContain("p01");
  });

  it("has() returns true for wishlisted id", () => {
    useWishlist.getState().toggle("p02");
    expect(useWishlist.getState().has("p02")).toBe(true);
  });

  it("has() returns false for absent id", () => {
    expect(useWishlist.getState().has("p99")).toBe(false);
  });

  it("multiple distinct ids coexist", () => {
    useWishlist.getState().toggle("p01");
    useWishlist.getState().toggle("p02");
    useWishlist.getState().toggle("p03");
    expect(useWishlist.getState().ids).toHaveLength(3);
  });

  it("clear removes all ids", () => {
    useWishlist.getState().toggle("p01");
    useWishlist.getState().toggle("p02");
    useWishlist.getState().clear();
    expect(useWishlist.getState().ids).toEqual([]);
  });
});
