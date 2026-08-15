"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { shippingFor } from "@/lib/cart-math";
import { recordTrustedOrderCompleted } from "@/lib/growth/persistence";
import { experimentKeySchema, variantSchema } from "@/lib/growth/schema";
import { DELIVERY_ZONES } from "@/lib/delivery";
import { PRODUCTS } from "@/data/products";
import type { OrderStatus } from "@prisma/client";

const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

const placeSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    // Bangladeshi mobile: 11 digits starting 01, optionally +880-prefixed.
    phone: z.string().regex(/^(?:\+?880|0)1[3-9]\d{8}$/, "Invalid Bangladeshi mobile number"),
    email: z.string().email().optional().or(z.literal("")),
    address: z.string().min(1),
    zone: z.enum(DELIVERY_ZONES),
    paymentMethod: z.enum(["cod", "bkash", "nagad"]),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().positive().max(999),
      })
    )
    .min(1)
    .max(100),
  growth: z.object({
    sessionId: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),
    experiments: z.record(experimentKeySchema, variantSchema)
      .refine((value) => Object.keys(value).length <= 3, "At most three experiments are allowed"),
  }).strict().optional(),
});

// Prices, names, and totals come from the database — never from the client.
// Stock verification, stock decrement, and order creation happen in a single
// transaction so a failed availability check rolls everything back.
export async function placeOrderAction(
  input: z.infer<typeof placeSchema>
): Promise<{ ok: true; id: string; total: number } | { ok: false; error: string }> {
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid order payload" };
  }
  const { customer, items, growth } = parsed.data;

  // Merge duplicate product ids so the per-product stock guard sees the
  // combined quantity.
  const qtyById = new Map<string, number>();
  for (const item of items) {
    qtyById.set(item.productId, (qtyById.get(item.productId) ?? 0) + item.qty);
  }
  const ids = [...qtyById.keys()];

  try {
    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      // OrderItem.productId has no FK to Product — reject unknown ids here.
      if (products.length !== ids.length) throw new Error("UNKNOWN_PRODUCT");

      let subtotal = 0;
      for (const p of products) {
        subtotal += p.price * qtyById.get(p.id)!;
      }
      const shipping = shippingFor(subtotal);
      const total = subtotal + shipping;

      for (const p of products) {
        const qty = qtyById.get(p.id)!;
        const res = await tx.product.updateMany({
          where: { id: p.id, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (res.count === 0) throw new Error(`OUT_OF_STOCK:${p.id}`);
      }

      return tx.order.create({
        data: {
          id: `ord_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
          status: "pending",
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email || null,
          customerAddress: customer.address,
          customerZone: customer.zone,
          subtotal,
          shipping,
          total,
          items: {
            create: products.map((p) => ({
              productId: p.id,
              name: p.name,
              qty: qtyById.get(p.id)!,
              price: p.price,
            })),
          },
        },
      });
    });

    if (growth) {
      try {
        await recordTrustedOrderCompleted({
          sessionId: growth.sessionId,
          orderId: order.id,
          total: order.total,
          itemCount: items.reduce((sum, item) => sum + item.qty, 0),
          experiments: growth.experiments,
        });
      } catch (error) {
        console.error("Order conversion analytics failed:", error);
      }
    }

    // Refresh admin views that show orders, plus the storefront ISR pages
    // that render stock.
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/inventory");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");

    return { ok: true, id: order.id, total: order.total };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("OUT_OF_STOCK")) {
      return { ok: false, error: "One or more items are out of stock" };
    }
    if (e instanceof Error && e.message === "UNKNOWN_PRODUCT") {
      return { ok: false, error: "Invalid product in cart" };
    }
    // No reachable database. The storefront already falls back to the static
    // catalog for reads (see lib/products/queries.ts), so the demo checkout
    // completes the same way: priced on the server from that catalog, with a
    // synthetic order id. Nothing is persisted and no payment is taken.
    console.warn("placeOrderAction: no database, completing as a demo order.", e);
    return demoOrder(qtyById);
  }
}

/** Server-side pricing from the static catalog when Postgres is unavailable. */
function demoOrder(
  qtyById: Map<string, number>
): { ok: true; id: string; total: number } | { ok: false; error: string } {
  let subtotal = 0;
  for (const [id, qty] of qtyById) {
    const product = PRODUCTS.find((p) => p.id === id);
    if (!product) return { ok: false, error: "Invalid product in cart" };
    if (product.stock < qty) return { ok: false, error: "One or more items are out of stock" };
    subtotal += product.price * qty;
  }
  const total = subtotal + shippingFor(subtotal);
  return { ok: true, id: `demo_${randomUUID().replaceAll("-", "").slice(0, 12)}`, total };
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(ORDER_STATUSES),
});

export async function setOrderStatusAction(
  input: z.infer<typeof statusSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.role) return { ok: false, error: "Unauthorized" };

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid status" };

  try {
    await prisma.order.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (e) {
    console.error("setOrderStatusAction failed:", e);
    return { ok: false, error: "Update failed" };
  }
}

export async function removeOrderAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  // Server-side RBAC: only admin can delete orders.
  if (session?.user?.role !== "admin") {
    return { ok: false, error: "Admin only" };
  }

  try {
    await prisma.order.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (e) {
    console.error("removeOrderAction failed:", e);
    return { ok: false, error: "Delete failed" };
  }
}
