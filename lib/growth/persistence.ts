import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  assignVariant,
  EXPERIMENTS,
  type ExperimentKey,
  type Variant,
} from "@/lib/growth/experiments";
import {
  experimentKeySchema,
  variantSchema,
  type PublicGrowthEvent,
} from "@/lib/growth/schema";

export type GrowthAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath: string;
  referrerCategory: "direct" | "search" | "social" | "referral" | "internal";
};

export type ExposureInput = {
  sessionId: string;
  experiment: ExperimentKey;
  variant: Variant;
  exposedAt: Date;
  attribution?: GrowthAttribution;
};

export const MAX_CLIENT_CLOCK_SKEW_MS = 5 * 60 * 1000;

const trustedOrderCompletedInputSchema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),
  orderId: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  total: z.number().int().min(0).max(100_000_000),
  itemCount: z.number().int().min(1).max(999),
  experiments: z.record(experimentKeySchema, variantSchema)
    .refine((value) => Object.keys(value).length <= 3, "At most three experiments are allowed")
    .optional(),
}).strict();

export type TrustedOrderCompletedInput = z.infer<typeof trustedOrderCompletedInputSchema>;

type PersistenceResult =
  | { accepted: true; duplicate: boolean }
  | { accepted: false; reason: "invalid_product" };

function sessionCreateData(sessionId: string, attribution?: GrowthAttribution) {
  return {
    id: sessionId,
    utmSource: attribution?.utmSource,
    utmMedium: attribution?.utmMedium,
    utmCampaign: attribution?.utmCampaign,
    landingPath: attribution?.landingPath,
    referrerCategory: attribution?.referrerCategory,
  };
}

async function upsertSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
  attribution?: GrowthAttribution,
) {
  return tx.growthSession.upsert({
    where: { id: sessionId },
    create: sessionCreateData(sessionId, attribution),
    // Attribution is first-touch. An existing session is deliberately only
    // touched for lastSeenAt by Prisma's @updatedAt behavior.
    update: {},
  });
}

function boundedClientTimestamp(clientTimestamp: Date, receivedAt: Date) {
  return Math.abs(clientTimestamp.getTime() - receivedAt.getTime()) <= MAX_CLIENT_CLOCK_SKEW_MS
    ? clientTimestamp
    : receivedAt;
}

function eventData(event: PublicGrowthEvent, receivedAt: Date) {
  const common = {
    id: event.eventId,
    sessionId: event.sessionId,
    name: event.name,
    occurredAt: boundedClientTimestamp(new Date(event.occurredAt), receivedAt),
    receivedAt,
  };

  switch (event.name) {
    case "product_viewed":
      return {
        ...common,
        productId: event.properties.productId,
        placement: event.properties.placement,
      };
    case "add_to_cart":
      return {
        ...common,
        productId: event.properties.productId,
        quantity: event.properties.quantity,
        unitPrice: event.properties.unitPrice,
        cartValue: event.properties.cartValue,
        cartSize: event.properties.cartSize,
        placement: event.properties.placement,
      };
    case "checkout_started":
      return {
        ...common,
        cartValue: event.properties.cartValue,
        cartSize: event.properties.cartSize,
      };
    case "checkout_step_completed":
      return {
        ...common,
        checkoutStep: event.properties.step,
        cartValue: event.properties.cartValue,
      };
  }
}

function productIdFor(event: PublicGrowthEvent) {
  return event.name === "product_viewed" || event.name === "add_to_cart"
    ? event.properties.productId
    : undefined;
}

function isEventIdConflict(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
    return false;
  }
  const meta = "meta" in error && typeof error.meta === "object" && error.meta !== null
    ? error.meta
    : undefined;
  const target = meta && "target" in meta ? meta.target : undefined;
  return (Array.isArray(target) && target.length === 1 && target[0] === "id")
    || target === "id"
    || target === "GrowthEvent_pkey";
}

export async function persistPublicEvent(
  event: PublicGrowthEvent,
  attribution: GrowthAttribution | undefined = event.attribution,
): Promise<PersistenceResult> {
  const receivedAt = new Date();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const productId = productIdFor(event);
      if (productId) {
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true },
        });
        if (!product) return { accepted: false, reason: "invalid_product" } as const;
      }

      await upsertSession(tx, event.sessionId, attribution);
      try {
        await tx.growthEvent.create({ data: eventData(event, receivedAt) });
      } catch (error) {
        if (isEventIdConflict(error)) {
          return { accepted: true, duplicate: true } as const;
        }
        throw error;
      }
      return { accepted: true, duplicate: false } as const;
    });
    return result;
  } catch (error) {
    console.error("Growth event persistence failed", error);
    throw error;
  }
}

export async function recordExposure(input: ExposureInput) {
  const definition = EXPERIMENTS[input.experiment];
  if (assignVariant(input.sessionId, input.experiment) !== input.variant) {
    throw new Error("INVALID_VARIANT");
  }
  const receivedAt = new Date();

  return prisma.$transaction(async (tx) => {
    await upsertSession(tx, input.sessionId, input.attribution);
    return tx.experimentExposure.upsert({
      where: {
        sessionId_experiment_version: {
          sessionId: input.sessionId,
          experiment: input.experiment,
          version: definition.version,
        },
      },
      create: {
        sessionId: input.sessionId,
        experiment: input.experiment,
        version: definition.version,
        variant: input.variant,
        exposedAt: boundedClientTimestamp(input.exposedAt, receivedAt),
        receivedAt,
      },
      update: {},
    });
  });
}

export async function recordTrustedOrderCompleted(input: TrustedOrderCompletedInput) {
  const parsed = trustedOrderCompletedInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("INVALID_TRUSTED_ORDER_EVENT");
  const trustedInput = parsed.data;

  for (const [experiment, variant] of Object.entries(trustedInput.experiments ?? {})) {
    if (assignVariant(trustedInput.sessionId, experiment as ExperimentKey) !== variant) {
      throw new Error("INVALID_VARIANT");
    }
  }
  const receivedAt = new Date();

  try {
    const duplicate = await prisma.$transaction(async (tx) => {
      await upsertSession(tx, trustedInput.sessionId);
      try {
        await tx.growthEvent.create({
          data: {
            id: `order_${trustedInput.orderId}`,
            sessionId: trustedInput.sessionId,
            name: "order_completed",
            occurredAt: receivedAt,
            receivedAt,
            orderId: trustedInput.orderId,
            cartValue: trustedInput.total,
            cartSize: trustedInput.itemCount,
          },
        });
      } catch (error) {
        if (isEventIdConflict(error)) return true;
        throw error;
      }
      return false;
    });
    return { accepted: true, duplicate } as const;
  } catch (error) {
    console.error("Trusted growth conversion persistence failed", error);
    throw error;
  }
}
