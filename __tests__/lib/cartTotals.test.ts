import { describe, it, expect } from "vitest";
import { cartTotals } from "@/lib/stores";
import { DELIVERY_CHARGE } from "@/lib/cart-math";
import type { Product } from "@/data/products";

const p = (id: string, price: number): Product =>
  ({ id, price } as unknown as Product);

// Real VeggieVan prices, in paisa: potato ৳45/kg, onion ৳70/kg,
// Family Fresh Basket ৳300.
const products = [p("p01", 4_500), p("p02", 7_000), p("p12", 30_000)];

describe("cartTotals", () => {
  it("returns zeros for an empty cart", () => {
    expect(cartTotals([], products)).toEqual({
      subtotal: 0,
      shipping: 0,
      total: 0,
      count: 0,
      DELIVERY_CHARGE,
    });
  });

  it("calculates subtotal and count correctly", () => {
    const { subtotal, count } = cartTotals(
      [{ productId: "p01", qty: 2 }, { productId: "p02", qty: 1 }],
      products
    );
    expect(subtotal).toBe(4_500 * 2 + 7_000); // ৳160
    expect(count).toBe(3);
  });

  it("adds the flat ৳40 delivery charge to a small order", () => {
    const { shipping, total } = cartTotals([{ productId: "p01", qty: 1 }], products);
    expect(shipping).toBe(DELIVERY_CHARGE);
    expect(total).toBe(4_500 + DELIVERY_CHARGE);
  });

  it("charges the same ৳40 on a large order — delivery never becomes free", () => {
    const { shipping, total } = cartTotals([{ productId: "p12", qty: 5 }], products);
    expect(shipping).toBe(DELIVERY_CHARGE);
    expect(total).toBe(150_000 + DELIVERY_CHARGE);
  });

  it("skips items whose productId is not in the products list", () => {
    const { subtotal, count } = cartTotals(
      [{ productId: "unknown", qty: 5 }],
      products
    );
    expect(subtotal).toBe(0);
    expect(count).toBe(0);
  });

  it("total = subtotal + delivery", () => {
    const result = cartTotals([{ productId: "p01", qty: 1 }], products);
    expect(result.total).toBe(result.subtotal + result.shipping);
  });
});
