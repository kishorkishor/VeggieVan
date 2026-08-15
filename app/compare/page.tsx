"use client";
import Link from "next/link";
import Image from "next/image";
import { useCompare, useCart } from "@/lib/stores";
import { useCatalog } from "@/lib/catalog-context";
import type { Nutrition, ProductRow } from "@/lib/products/queries";
import { formatBDT } from "@/lib/utils";
import { Check, X, Scale, Plus } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

// The seed always writes this shape; Prisma types it as JsonValue.
// (Mirrors nutritionOf in lib/products/queries.ts, which is server-only.)
function nutritionOf(p: ProductRow): Nutrition {
  return p.nutrition as Nutrition;
}

export default function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const add = useCart((s) => s.add);
  const products = useCatalog();
  const items = products.filter((p) => ids.includes(p.id));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Scale className="mx-auto h-12 w-12 text-vv-leafDark" />
        <h1 className="mt-4 font-display text-4xl">Compare up to 4 products</h1>
        <p className="mt-2 text-vv-mute">
          Tap the scale icon on any product card to start comparing.
        </p>
        <Link href="/products" className="btn-primary mt-6 inline-flex">
          Browse produce
        </Link>
      </div>
    );
  }

  const rows: { label: string; render: (p: (typeof items)[number]) => React.ReactNode }[] = [
    { label: "Price", render: (p) => <span className="font-semibold">{formatBDT(p.price)}</span> },
    { label: "Unit", render: (p) => p.unit },
    { label: "Origin", render: (p) => p.origin },
    { label: "Category", render: (p) => <span className="capitalize">{p.category}</span> },
    {
      label: "Organic",
      render: (p) =>
        p.organic ? (
          <Check className="h-4 w-4 text-vv-leafDark" />
        ) : (
          <X className="h-4 w-4 text-vv-mute" />
        ),
    },
    {
      label: "In season",
      render: (p) =>
        p.inSeason ? (
          <Check className="h-4 w-4 text-vv-leafDark" />
        ) : (
          <X className="h-4 w-4 text-vv-mute" />
        ),
    },
    { label: "Calories (per 100g)", render: (p) => `${nutritionOf(p).calories} kcal` },
    { label: "Carbs", render: (p) => `${nutritionOf(p).carbs} g` },
    { label: "Protein", render: (p) => `${nutritionOf(p).protein} g` },
    { label: "Fiber", render: (p) => `${nutritionOf(p).fiber} g` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            <Scale className="h-8 w-8 text-vv-leafDark" /> Compare
          </h1>
          <p className="mt-1 text-sm text-vv-mute">Side-by-side view of your selected produce.</p>
        </div>
        <button onClick={clear} className="btn-outline text-sm">Clear all</button>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-vv-line bg-white">
        <table className="min-w-full">
          <thead>
            <tr>
              <th className="w-36 border-b border-vv-line p-4 text-left text-xs font-semibold uppercase tracking-wider text-vv-mute"></th>
              {items.map((p) => (
                <th key={p.id} className="border-b border-vv-line p-4 text-left align-top">
                  <div className="relative">
                    <button
                      onClick={() => remove(p.id)}
                      className="absolute right-0 top-0 rounded-full p-1 text-vv-mute hover:bg-vv-red/10 hover:text-vv-red"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <Link href={`/products/${p.slug}`} className="block">
                      <div className="relative mb-3 aspect-square w-32 overflow-hidden rounded-xl">
                        <Image src={p.images[0]} alt={p.name} fill sizes="128px" className="object-cover" />
                      </div>
                      <div className="font-display text-base font-semibold leading-tight">
                        {p.name}
                      </div>
                      <div className="text-xs text-vv-mute">{p.tagline}</div>
                    </Link>
                  </div>
                </th>
              ))}
              {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                <th key={i} className="border-b border-vv-line p-4">
                  <Link
                    href="/products"
                    className="grid h-32 w-32 place-items-center rounded-xl border border-dashed border-vv-line text-xs text-vv-mute hover:border-vv-leaf hover:text-vv-leafDark"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Plus className="h-5 w-5" />
                      Add product
                    </div>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="even:bg-vv-cream/50">
                <td className="p-4 text-xs font-medium uppercase tracking-wider text-vv-mute">
                  {row.label}
                </td>
                {items.map((p) => (
                  <td key={p.id} className="p-4 text-sm">
                    {row.render(p)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="p-4"></td>
              {items.map((p) => (
                <td key={p.id} className="p-4">
                  <button
                    onClick={() => {
                      add(p.id);
                      toast(`Added ${p.name}`);
                    }}
                    className="btn-primary w-full text-sm"
                  >
                    Add to basket
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
