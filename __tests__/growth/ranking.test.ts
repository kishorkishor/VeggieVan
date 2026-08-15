import { describe, expect, it } from "vitest";
import { rankRelatedProducts } from "@/lib/growth/ranking";

describe("rankRelatedProducts", () => {
  it("puts in-stock complementary categories first with stable ties", () => {
    // Anchored on "vegetables", whose affinity runs essentials → leafy →
    // baskets. So the in-stock essentials item leads, the in-stock leafy item
    // follows, and the out-of-stock item sinks regardless of its category.
    const products = [
      { id: "b", category: "essentials", stock: 4 },
      { id: "c", category: "leafy", stock: 0 },
      { id: "a", category: "leafy", stock: 4 },
    ];
    expect(rankRelatedProducts(products, "vegetables").map((product) => product.id))
      .toEqual(["b", "a", "c"]);
  });

  it("does not mutate the server-provided list", () => {
    const products = [{ id: "b", category: "essentials", stock: 1 }, { id: "a", category: "leafy", stock: 1 }];
    rankRelatedProducts(products, "vegetables");
    expect(products.map((product) => product.id)).toEqual(["b", "a"]);
  });
});
