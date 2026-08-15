import { notFound } from "next/navigation";
import {
  getProductBySlug,
  listAllProductSlugs,
  listRelatedProducts,
  nutritionOf,
} from "@/lib/products/queries";
import PDPClient from "./PDPClient";

// Storefront ISR: revalidate every minute as a safety net; admin mutations
// trigger an immediate revalidatePath for instant propagation.
export const revalidate = 60;

export async function generateStaticParams() {
  try {
    return await listAllProductSlugs();
  } catch {
    // Build-time DB unreachable — skip prerendering, pages will be SSR'd.
    return [];
  }
}

export default async function PDPPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return notFound();

  const related = await listRelatedProducts(product.category, product.id, 4);

  return (
    <PDPClient
      product={product}
      nutrition={nutritionOf(product)}
      related={related}
    />
  );
}
