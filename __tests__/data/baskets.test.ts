import { describe, it, expect } from "vitest";
import { PRODUCTS, BASKET_CONTENTS, CATEGORIES } from "@/data/products";

const bySlug = new Map(PRODUCTS.map((p) => [p.slug, p]));

describe("basket arithmetic", () => {
  it("covers every basket product in the catalog", () => {
    const basketSlugs = PRODUCTS.filter((p) => p.category === "baskets").map((p) => p.slug).sort();
    expect(Object.keys(BASKET_CONTENTS).sort()).toEqual(basketSlugs);
  });

  it.each(Object.entries(BASKET_CONTENTS))(
    "%s member prices sum to the comparison total printed in the business plan",
    (slug, { items, comparisonTotal }) => {
      const sum = items.reduce((total, memberSlug) => {
        const member = bySlug.get(memberSlug);
        expect(member, `${slug} references unknown product "${memberSlug}"`).toBeDefined();
        return total + member!.price;
      }, 0);
      expect(sum).toBe(comparisonTotal);
    }
  );

  it.each(Object.entries(BASKET_CONTENTS))(
    "%s is cheaper than its parts, by the 10–11%% the plan advertises",
    (slug, { comparisonTotal }) => {
      const basket = bySlug.get(slug)!;
      const savingPct = ((comparisonTotal - basket.price) / comparisonTotal) * 100;
      expect(basket.price).toBeLessThan(comparisonTotal);
      expect(savingPct).toBeGreaterThanOrEqual(10);
      expect(savingPct).toBeLessThanOrEqual(11.5);
    }
  );

  it("holds five items in every basket, including Family Fresh", () => {
    for (const [slug, { items }] of Object.entries(BASKET_CONTENTS)) {
      expect(items, `${slug} should hold five items`).toHaveLength(5);
    }
  });
});

describe("catalog integrity", () => {
  it("has unique slugs and ids", () => {
    expect(new Set(PRODUCTS.map((p) => p.slug)).size).toBe(PRODUCTS.length);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
  });

  it("prices everything in whole taka", () => {
    for (const p of PRODUCTS) {
      expect(p.price % 100, `${p.slug} has a fractional taka price`).toBe(0);
      expect(p.price).toBeGreaterThan(0);
    }
  });

  it("only uses categories the storefront can render", () => {
    const known = new Set(CATEGORIES.map((c) => c.id));
    for (const p of PRODUCTS) expect(known.has(p.category)).toBe(true);
  });

  it("claims no organic certification, because the business plan claims none", () => {
    expect(PRODUCTS.every((p) => p.organic === false)).toBe(true);
  });
});
