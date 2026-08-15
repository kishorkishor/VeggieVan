import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: true };
}>;

export async function listOrders(): Promise<OrderWithItems[]> {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  if (!id) return null;
  try {
    return await prisma.order.findUnique({ where: { id }, include: { items: true } });
  } catch {
    // No static fallback exists for orders; the confirmation page must never
    // 500 right after a customer paid, so degrade to the generic view.
    return null;
  }
}

export async function orderStats() {
  // Single round-trip: aggregate + count in parallel.
  const [orders, pending, revenueAgg] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { NOT: { status: "cancelled" } },
    }),
  ]);
  return {
    total: orders,
    pending,
    revenue: revenueAgg._sum.total ?? 0,
  };
}

export async function recentOrders(limit = 6): Promise<OrderWithItems[]> {
  return prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
}
