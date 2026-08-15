import { describe, expect, it } from "vitest";
import {
  addToCartEvent,
  checkoutStartedEvent,
  checkoutStepCompletedEvent,
  priceBand,
  productViewedEvent,
} from "@/lib/growth/instrumentation";

const products = [
  { id: "p01", price: 549 },
  { id: "p02", price: 329 },
];

describe("storefront growth instrumentation", () => {
  it("uses stable euro price bands at the boundaries", () => {
    expect(priceBand(499)).toBe("under_5");
    expect(priceBand(500)).toBe("5_to_10");
    expect(priceBand(1000)).toBe("5_to_10");
    expect(priceBand(1001)).toBe("over_10");
  });

  it("builds the allowlisted product-view payload", () => {
    expect(productViewedEvent({ id: "p01", category: "vegetables", price: 549 })).toEqual({
      name: "product_viewed",
      properties: {
        productId: "p01",
        category: "vegetables",
        priceBand: "5_to_10",
        placement: "direct",
      },
    });
  });

  it("uses the resulting cart state including existing quantities", () => {
    const event = addToCartEvent({
      product: { id: "p01", price: 549 },
      quantity: 2,
      items: [
        { productId: "p01", qty: 5 },
        { productId: "p02", qty: 1 },
      ],
      products,
      placement: "recommendation",
    });

    expect(event).toEqual({
      name: "add_to_cart",
      properties: {
        productId: "p01",
        quantity: 2,
        unitPrice: 549,
        cartValue: 3074,
        cartSize: 6,
        placement: "recommendation",
      },
    });
  });

  it("builds checkout start and validated step payloads from current totals", () => {
    const items = [
      { productId: "p01", qty: 2 },
      { productId: "p02", qty: 1 },
    ];

    expect(checkoutStartedEvent(items, products)).toEqual({
      name: "checkout_started",
      properties: { cartValue: 1427, cartSize: 3 },
    });
    expect(checkoutStepCompletedEvent(2, items, products)).toEqual({
      name: "checkout_step_completed",
      properties: { step: 2, stepName: "delivery", cartValue: 1427 },
    });
  });
});
