import { listProducts, type ProductRow } from "@/lib/products/queries";
import { ProductsClient } from "./ProductsClient";

export const revalidate = 60;

export default async function ProductsPage() {
  let products: ProductRow[] = [];
  try {
    products = await listProducts();
  } catch (e) {
    console.error("listProducts failed on /products:", e);
    // Empty list will render the "no produce matches" state — better than crashing.
  }
  return <ProductsClient products={products} />;
}
