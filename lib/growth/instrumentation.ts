import type { CartItem } from "@/lib/stores";
import type { PublicGrowthEventInput } from "@/lib/growth/provider";

type PricedProduct = { id: string; price: number };
type ProductCategory = "essentials" | "vegetables" | "baskets";
export type AddToCartPlacement = "pdp" | "listing" | "recommendation" | "other";
type CheckoutStep = 1 | 2 | 3;

export function priceBand(price: number): "under_5" | "5_to_10" | "over_10" {
  if (price < 500) return "under_5";
  if (price <= 1000) return "5_to_10";
  return "over_10";
}

function cartSnapshot(items: readonly CartItem[], products: readonly PricedProduct[]) {
  let cartValue = 0;
  let cartSize = 0;
  for (const item of items) {
    const product = products.find(({ id }) => id === item.productId);
    if (!product) continue;
    cartValue += product.price * item.qty;
    cartSize += item.qty;
  }
  return { cartValue, cartSize };
}

export function productViewedEvent(product: {
  id: string;
  category: ProductCategory;
  price: number;
}): PublicGrowthEventInput {
  return {
    name: "product_viewed",
    properties: {
      productId: product.id,
      category: product.category,
      priceBand: priceBand(product.price),
      placement: "direct",
    },
  };
}

export function addToCartEvent(input: {
  product: PricedProduct;
  quantity: number;
  items: readonly CartItem[];
  products: readonly PricedProduct[];
  placement: AddToCartPlacement;
}): PublicGrowthEventInput {
  return {
    name: "add_to_cart",
    properties: {
      productId: input.product.id,
      quantity: input.quantity,
      unitPrice: input.product.price,
      ...cartSnapshot(input.items, input.products),
      placement: input.placement,
    },
  };
}

export function checkoutStartedEvent(
  items: readonly CartItem[],
  products: readonly PricedProduct[],
): PublicGrowthEventInput {
  return { name: "checkout_started", properties: cartSnapshot(items, products) };
}

const STEP_NAMES = {
  1: "address",
  2: "delivery",
  3: "payment",
} as const;

export function checkoutStepCompletedEvent(
  step: CheckoutStep,
  items: readonly CartItem[],
  products: readonly PricedProduct[],
): PublicGrowthEventInput {
  return {
    name: "checkout_step_completed",
    properties: {
      step,
      stepName: STEP_NAMES[step],
      cartValue: cartSnapshot(items, products).cartValue,
    },
  };
}
