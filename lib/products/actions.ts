"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PRODUCTS } from "@/data/products";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { ok: false as const, error: "Admin only" };
  }
  return { ok: true as const };
}

const patchSchema = z.object({
  id: z.string().min(1),
  patch: z
    .object({
      stock: z.number().int().nonnegative().optional(),
      price: z.number().int().nonnegative().optional(),
      organic: z.boolean().optional(),
      featured: z.boolean().optional(),
      inSeason: z.boolean().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "Empty patch"),
});

export async function updateProductAction(
  input: z.infer<typeof patchSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid patch" };

  try {
    await prisma.product.update({
      where: { id: parsed.data.id },
      data: parsed.data.patch,
    });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    // Storefront ISR: surfaces price/stock/flag edits to public pages.
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");
    return { ok: true };
  } catch (e) {
    console.error("updateProductAction failed:", e);
    return { ok: false, error: "Update failed" };
  }
}

const SEED_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

export async function resetProductAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const seed = SEED_BY_ID.get(id);
  if (!seed) return { ok: false, error: "Unknown product" };

  try {
    await prisma.product.update({
      where: { id },
      data: {
        stock: seed.stock,
        price: seed.price,
        organic: seed.organic,
        featured: seed.featured ?? false,
        inSeason: seed.inSeason,
      },
    });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    // Storefront ISR: surfaces price/stock/flag edits to public pages.
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");
    return { ok: true };
  } catch (e) {
    console.error("resetProductAction failed:", e);
    return { ok: false, error: "Reset failed" };
  }
}

export async function resetAllProductsAction(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  try {
    await prisma.$transaction(
      PRODUCTS.map((seed) =>
        prisma.product.update({
          where: { id: seed.id },
          data: {
            stock: seed.stock,
            price: seed.price,
            organic: seed.organic,
            featured: seed.featured ?? false,
            inSeason: seed.inSeason,
          },
        })
      )
    );
    revalidatePath("/admin/inventory");
    revalidatePath("/admin");
    // Storefront ISR: surfaces price/stock/flag edits to public pages.
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");
    return { ok: true, count: PRODUCTS.length };
  } catch (e) {
    console.error("resetAllProductsAction failed:", e);
    return { ok: false, error: "Reset all failed" };
  }
}

// Stock decrement now happens inside placeOrderAction's transaction
// (lib/orders/actions.ts) — the old public decrementStockAction let anyone
// zero out inventory without buying anything.
