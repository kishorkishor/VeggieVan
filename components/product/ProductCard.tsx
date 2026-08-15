"use client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, Plus, Scale, Leaf } from "lucide-react";
import { formatBDT, cn } from "@/lib/utils";
import { useCart, useWishlist, useCompare } from "@/lib/stores";
import { toast } from "@/components/ui/Toaster";
import { useCatalog } from "@/lib/catalog-context";
import { BASKET_CONTENTS } from "@/data/products";
import { useGrowth } from "@/lib/growth/GrowthProvider";
import { addToCartEvent } from "@/lib/growth/instrumentation";
import type { AddToCartPlacement } from "@/lib/growth/instrumentation";

// Structural shape — accepts both the Prisma `Product` row and the static
// `data/products.ts` Product type. Keeps this card decoupled from either.
export type CardProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  unit: string;
  price: number;
  origin: string;
  organic: boolean;
  inSeason: boolean;
  stock: number;
  images: string[];
};

export function ProductCard({
  p,
  index = 0,
  placement = "listing",
}: {
  p: CardProduct;
  index?: number;
  placement?: AddToCartPlacement;
}) {
  const add = useCart((s) => s.add);
  const products = useCatalog();
  const { track } = useGrowth();
  const wl = useWishlist();
  const cmp = useCompare();
  const inWl = wl.ids.includes(p.id);
  const inCmp = cmp.ids.includes(p.id);
  const soldOut = p.stock <= 0;

  // Baskets advertise what they save against buying the same five items
  // separately. Derived, never hardcoded, so it tracks the catalog.
  const basket = BASKET_CONTENTS[p.slug];
  const savingPct = basket
    ? Math.round(((basket.comparisonTotal - p.price) / basket.comparisonTotal) * 100)
    : null;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.03 }}
      className="group card relative flex flex-col overflow-hidden hover:-translate-y-1 hover:shadow-lift"
    >
      <Link href={`/products/${p.slug}`} className="relative block aspect-square overflow-hidden bg-white">
        <Image
          src={p.images[0]}
          alt={p.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <div className="flex flex-col gap-1">
            {savingPct !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-vv-red/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                <Leaf className="h-2.5 w-2.5" /> Save {savingPct}%
              </span>
            )}
            {soldOut && (
              <span className="inline-flex w-fit items-center rounded-full bg-vv-ink/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Sold out
              </span>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end gap-1.5 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            aria-label="Compare"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!inCmp && cmp.ids.length >= 4) return toast("Compare up to 4", "info");
              cmp.toggle(p.id);
              toast(inCmp ? "Removed from compare" : "Added to compare");
            }}
            className={cn(
              "pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow-soft backdrop-blur transition hover:scale-110",
              inCmp && "bg-vv-leaf text-white"
            )}
          >
            <Scale className="h-4 w-4" />
          </button>
          <button
            aria-label="Wishlist"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              wl.toggle(p.id);
              toast(inWl ? "Removed from wishlist" : "Saved to wishlist");
            }}
            className={cn(
              "pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow-soft backdrop-blur transition hover:scale-110",
              inWl && "bg-vv-red text-white"
            )}
          >
            <Heart className={cn("h-4 w-4", inWl && "fill-current")} />
          </button>
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold leading-tight text-vv-ink">
            <Link href={`/products/${p.slug}`} className="hover:text-vv-leafDark">
              {p.name}
            </Link>
          </h3>
          <div className="shrink-0 text-right">
            <div className="font-semibold tabular-nums">{formatBDT(p.price)}</div>
            <div className="text-[11px] text-vv-mute">{p.unit}</div>
          </div>
        </div>
        <p className="text-xs text-vv-mute">{p.origin} · {p.tagline}</p>
        <button
          onClick={() => {
            add(p.id);
            track(addToCartEvent({
              product: p,
              quantity: 1,
              items: useCart.getState().items,
              products,
              placement,
            }));
            toast(`Added ${p.name}`);
          }}
          disabled={soldOut}
          aria-disabled={soldOut}
          className={cn(
            "mt-3 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition",
            soldOut
              ? "cursor-not-allowed bg-vv-ink/10 text-vv-mute"
              : "bg-vv-ink text-white hover:bg-vv-leafDark active:scale-95"
          )}
        >
          {soldOut ? "Sold out" : (<><Plus className="h-4 w-4" /> Add to basket</>)}
        </button>
      </div>
    </motion.article>
  );
}
