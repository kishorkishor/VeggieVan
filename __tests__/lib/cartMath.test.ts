import { describe, it, expect } from "vitest";
import { shippingFor, DELIVERY_CHARGE } from "@/lib/cart-math";

// The business plan sets a flat BDT 40 delivery charge per order, charged
// separately from the product price. There is no free-delivery threshold and
// no minimum order — the charge does not vary with basket size.
describe("shippingFor", () => {
  it("charges nothing for an empty cart", () => {
    expect(shippingFor(0)).toBe(0);
  });

  it("charges the flat rate on the smallest possible order", () => {
    expect(shippingFor(1)).toBe(DELIVERY_CHARGE);
  });

  it("charges the same flat rate no matter how large the order is", () => {
    for (const subtotal of [4_500, 29_900, 60_000, 250_000, 1_000_000]) {
      expect(shippingFor(subtotal)).toBe(DELIVERY_CHARGE);
    }
  });

  it("never discounts delivery — there is no free-delivery threshold", () => {
    const charges = new Set(
      Array.from({ length: 50 }, (_, i) => shippingFor((i + 1) * 5_000))
    );
    expect(charges).toEqual(new Set([DELIVERY_CHARGE]));
  });

  it("uses the ৳40 figure the storefront advertises", () => {
    expect(DELIVERY_CHARGE).toBe(4_000);
  });
});
