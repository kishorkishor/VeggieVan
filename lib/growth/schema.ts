import { z } from "zod";
import { EXPERIMENTS, type ExperimentKey, type Variant } from "@/lib/growth/experiments";

const opaqueId = z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/);
const entityId = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const money = z.number().int().min(0).max(100_000_000);
const acquisitionToken = (maxLength: number) => z.string().trim()
  .min(1)
  .max(maxLength)
  .regex(/^[a-zA-Z0-9_-]+$/);
const experimentKeys = Object.keys(EXPERIMENTS) as [ExperimentKey, ...ExperimentKey[]];
export const experimentKeySchema = z.enum(experimentKeys);
export const variantSchema = z.enum(["control", "treatment"] satisfies [Variant, ...Variant[]]);
const experimentsSchema = z.record(experimentKeySchema, variantSchema)
  .refine((value) => Object.keys(value).length <= 3, "At most three experiments are allowed");
export const attributionSchema = z.object({
  utmSource: acquisitionToken(80).optional(),
  utmMedium: acquisitionToken(80).optional(),
  utmCampaign: acquisitionToken(120).optional(),
  landingPath: z.enum([
    "/",
    "/products",
    "/products/:slug",
    "/checkout",
    "/checkout/success",
    "/compare",
    "/wishlist",
    "/other",
  ]),
  referrerCategory: z.enum(["direct", "search", "social", "referral", "internal"]),
}).strict();
const common = {
  eventId: opaqueId,
  sessionId: opaqueId,
  occurredAt: z.string().datetime(),
  experiments: experimentsSchema.optional(),
  attribution: attributionSchema.optional(),
};

export const publicGrowthEventSchema = z.discriminatedUnion("name", [
  z.object({
    ...common,
    name: z.literal("product_viewed"),
    properties: z.object({
      productId: entityId,
      category: z.enum(["essentials", "vegetables", "baskets"]),
      priceBand: z.enum(["under_5", "5_to_10", "over_10"]),
      placement: z.enum(["catalog", "recommendation", "direct"]),
    }).strict(),
  }).strict(),
  z.object({
    ...common,
    name: z.literal("add_to_cart"),
    properties: z.object({
      productId: entityId,
      quantity: z.number().int().min(1).max(999),
      unitPrice: money,
      cartValue: money,
      cartSize: z.number().int().min(1).max(999),
      placement: z.enum(["pdp", "listing", "recommendation", "other"]),
    }).strict(),
  }).strict(),
  z.object({
    ...common,
    name: z.literal("checkout_started"),
    properties: z.object({
      cartValue: money,
      cartSize: z.number().int().min(1).max(999),
    }).strict(),
  }).strict(),
  z.object({
    ...common,
    name: z.literal("checkout_step_completed"),
    properties: z.object({
      step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      stepName: z.enum(["address", "delivery", "payment"]),
      cartValue: money,
    }).strict(),
  }).strict(),
]);

export const trustedOrderEventSchema = z.object({
  eventId: opaqueId,
  sessionId: opaqueId.optional(),
  occurredAt: z.string().datetime(),
  name: z.literal("order_completed"),
  experiments: experimentsSchema.optional(),
  properties: z.object({
    orderId: entityId,
    orderTotal: money,
    itemCount: z.number().int().min(1).max(999),
  }).strict(),
}).strict();

export type PublicGrowthEvent = z.infer<typeof publicGrowthEventSchema>;
