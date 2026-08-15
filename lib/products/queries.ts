import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { presentProduct, presentProducts } from "@/lib/products/presentation";
import { PRODUCTS } from "@/data/products";

export type ProductRow = Prisma.ProductGetPayload<object>;

export type Nutrition = {
  calories: number;
  carbs: number;
  protein: number;
  fiber: number;
};

function staticProductRows(): ProductRow[] {
  const now = new Date(0);

  return PRODUCTS.map((product) => ({
    ...product,
    featured: product.featured ?? false,
    createdAt: now,
    updatedAt: now,
  })) as ProductRow[];
}

// Prisma stores nutrition as JsonValue. The seed always writes the same shape,
// but the type system doesn't know that — narrow at the boundary.
export function nutritionOf(p: ProductRow): Nutrition {
  return p.nutrition as Nutrition;
}

export async function listProducts(): Promise<ProductRow[]> {
  let products: ProductRow[];
  try {
    products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  } catch {
    products = staticProductRows().sort((a, b) => a.name.localeCompare(b.name));
  }
  return presentProducts(products);
}

export async function lowStockCount(threshold = 10): Promise<number> {
  try {
    return await prisma.product.count({ where: { stock: { lte: threshold } } });
  } catch {
    return PRODUCTS.filter((p) => p.stock <= threshold).length;
  }
}

export async function listFeaturedProducts(limit = 8): Promise<ProductRow[]> {
  let products: ProductRow[];
  try {
    products = await prisma.product.findMany({
      where: { featured: true },
      orderBy: { name: "asc" },
      take: limit,
    });
  } catch {
    products = staticProductRows()
      .filter((product) => product.featured)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }
  return presentProducts(products);
}

export async function getProductBySlug(slug: string): Promise<ProductRow | null> {
  let product: ProductRow | null;
  try {
    product = await prisma.product.findUnique({ where: { slug } });
  } catch {
    product = staticProductRows().find((p) => p.slug === slug) ?? null;
  }
  return product ? presentProduct(product) : null;
}

export async function listRelatedProducts(
  category: ProductRow["category"],
  excludeId: string,
  limit = 4
): Promise<ProductRow[]> {
  let products: ProductRow[];
  try {
    products = await prisma.product.findMany({
      where: { category, NOT: { id: excludeId } },
      take: limit,
      orderBy: { name: "asc" },
    });
  } catch {
    products = staticProductRows()
      .filter((product) => product.category === category && product.id !== excludeId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }
  return presentProducts(products);
}

export async function listAllProductSlugs(): Promise<{ slug: string }[]> {
  try {
    return await prisma.product.findMany({ select: { slug: true } });
  } catch {
    return PRODUCTS.map(({ slug }) => ({ slug }));
  }
}
