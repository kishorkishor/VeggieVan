"use client";
import { createContext, useContext } from "react";
import type { ProductRow } from "@/lib/products/queries";

// The root layout fetches the presented catalog on the server and shares it
// with client components (cart, search, compare, wishlist) through this
// context, so they always render live DB data instead of the static seed.
const CatalogContext = createContext<ProductRow[]>([]);

export function CatalogProvider({
  products,
  children,
}: {
  products: ProductRow[];
  children: React.ReactNode;
}) {
  return (
    <CatalogContext.Provider value={products}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog(): ProductRow[] {
  return useContext(CatalogContext);
}
