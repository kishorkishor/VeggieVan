"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useState, Suspense } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { Filters } from "@/components/product/Filters";
import { SlidersHorizontal, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ProductRow } from "@/lib/products/queries";
import type { Category } from "@prisma/client";
import { categoryLabel } from "@/data/products";

function ProductsInner({ products }: { products: ProductRow[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const category = sp.get("category") as Category | null;
  const unit = sp.get("unit");
  const maxPrice = sp.get("maxPrice") ? Number(sp.get("maxPrice")) : null;
  const sort = sp.get("sort") || "featured";

  const filtered = useMemo(() => {
    let list = products.slice();
    if (category) list = list.filter((p) => p.category === category);
    if (unit) list = list.filter((p) => p.unit === unit);
    if (maxPrice) list = list.filter((p) => p.price <= maxPrice);

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return list;
  }, [products, category, unit, maxPrice, sort]);

  const setSort = (v: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set("sort", v);
    router.replace(`/products?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            {category ? categoryLabel(category) : "All vegetables"}
          </h1>
          <p className="mt-1 text-sm text-vv-mute">
            {filtered.length} {filtered.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSheetOpen(true)}
            className="btn-outline text-sm lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filter
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="input w-auto cursor-pointer pr-8"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Filters />
          </div>
        </aside>

        <section>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-vv-line p-10 text-center">
              <div className="text-4xl">🥬</div>
              <h3 className="mt-3 font-display text-xl">Nothing matches those filters</h3>
              <p className="mt-1 text-sm text-vv-mute">Try clearing a filter to see more.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p, i) => (
                <ProductCard key={p.id} p={p} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Mobile filter sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 z-[60] bg-vv-ink/40 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[70] max-h-[85vh] overflow-y-auto rounded-t-3xl bg-vv-cream p-5 lg:hidden"
            >
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-vv-ink/15" />
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-2xl">Filter</h3>
                <button onClick={() => setSheetOpen(false)} className="rounded-full p-2 hover:bg-vv-ink/5">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Filters />
              <button onClick={() => setSheetOpen(false)} className="btn-primary mt-6 w-full">
                Show {filtered.length} results
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ProductsClient({ products }: { products: ProductRow[] }) {
  return (
    <Suspense fallback={<div className="p-10 text-center text-vv-mute">Loading…</div>}>
      <ProductsInner products={products} />
    </Suspense>
  );
}
