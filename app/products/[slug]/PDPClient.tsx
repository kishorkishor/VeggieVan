"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Scale, Leaf, MapPin, Minus, Plus, ShoppingBasket, Truck, Shield } from "lucide-react";
import confetti from "canvas-confetti";
import { formatBDT, cn } from "@/lib/utils";
import { useCart, useWishlist, useCompare } from "@/lib/stores";
import { ProductCard } from "@/components/product/ProductCard";
import { toast } from "@/components/ui/Toaster";
import type { Nutrition, ProductRow } from "@/lib/products/queries";
import { useCatalog } from "@/lib/catalog-context";
import { BASKET_CONTENTS } from "@/data/products";
import { ExperimentExposure } from "@/components/growth/ExperimentExposure";
import { useGrowth } from "@/lib/growth/GrowthProvider";
import { addToCartEvent, productViewedEvent } from "@/lib/growth/instrumentation";
import { rankRelatedProducts } from "@/lib/growth/ranking";

export default function PDPClient({
  product: p,
  nutrition,
  related,
}: {
  product: ProductRow;
  nutrition: Nutrition;
  related: ProductRow[];
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const products = useCatalog();
  const { ready, track, variant } = useGrowth();
  const viewedProduct = useRef<string | undefined>(undefined);
  const wl = useWishlist();
  const cmp = useCompare();

  const inWl = wl.has(p.id);
  const inCmp = cmp.has(p.id);
  const displayedRelated = useMemo(() => (
    variant("related_product_ranking_v1") === "treatment"
      ? rankRelatedProducts(related, p.category)
      : related
  ), [p.category, related, variant]);

  useEffect(() => {
    if (!ready || viewedProduct.current === p.id) return;
    viewedProduct.current = p.id;
    track(productViewedEvent(p));
  }, [p, ready, track]);

  const onAdd = () => {
    add(p.id, qty);
    track(addToCartEvent({
      product: p,
      quantity: qty,
      items: useCart.getState().items,
      products,
      placement: "pdp",
    }));
    toast(`Added ${qty} × ${p.name}`);
  };

  const onWish = () => {
    wl.toggle(p.id);
    if (!inWl) {
      confetti({
        particleCount: 40,
        spread: 55,
        startVelocity: 28,
        origin: { x: 0.85, y: 0.35 },
        colors: ["#E63946", "#F4D03F", "#F39C12", "#7CB342"],
      });
      toast("Saved to wishlist");
    } else {
      toast("Removed from wishlist");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-6 text-xs text-vv-mute">
        <Link href="/products" className="hover:underline">All vegetables</Link>
        <span className="mx-2">/</span>
        <Link href={`/products?category=${p.category}`} className="hover:underline capitalize">
          {p.category}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-vv-ink">{p.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-vv-line bg-white shadow-soft">
            <AnimatePresence mode="wait">
              <motion.div
                key={imageIndex}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="absolute inset-0"
              >
                <Image
                  src={p.images[imageIndex]}
                  alt={p.name}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </motion.div>
            </AnimatePresence>
            <div className="absolute left-4 top-4 flex flex-col gap-2">
              {BASKET_CONTENTS[p.slug] && (
                <span className="inline-flex items-center gap-1 rounded-full bg-vv-red px-3 py-1 text-xs font-semibold text-white">
                  <Leaf className="h-3 w-3" /> Cheaper than buying the five separately
                </span>
              )}
            </div>
          </div>
          {p.images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {p.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setImageIndex(i)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-xl border-2 bg-white",
                    i === imageIndex ? "border-vv-leafDark" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  <Image src={src} alt="" fill sizes="120px" className="object-contain p-2" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2 text-sm text-vv-mute">
            <MapPin className="h-3.5 w-3.5" /> From {p.origin}
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {p.name}
          </h1>
          <p className="mt-2 text-lg text-vv-ink/70">{p.tagline}</p>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-3xl font-semibold">{formatBDT(p.price)}</span>
            <span className="text-sm text-vv-mute">/ {p.unit}</span>
          </div>

          <p className="mt-6 max-w-prose text-vv-ink/80">{p.description}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-vv-line bg-white p-1">
              <button
                aria-label="Decrease"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="rounded-full p-2 hover:bg-vv-ink/5"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-medium tabular-nums">{qty}</span>
              <button
                aria-label="Increase"
                onClick={() => setQty((q) => q + 1)}
                className="rounded-full p-2 hover:bg-vv-ink/5"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={onAdd}
              disabled={p.stock <= 0}
              aria-disabled={p.stock <= 0}
              className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <ShoppingBasket className="h-4 w-4" />
              {p.stock <= 0 ? "Sold out" : <>Add to basket · {formatBDT(p.price * qty)}</>}
            </button>
            <button
              onClick={onWish}
              aria-label="Wishlist"
              className={cn("btn-outline !px-3", inWl && "border-vv-red text-vv-red")}
            >
              <Heart className={cn("h-4 w-4", inWl && "fill-current")} />
            </button>
            <button
              onClick={() => cmp.toggle(p.id)}
              aria-label="Compare"
              className={cn("btn-outline !px-3", inCmp && "border-vv-leaf text-vv-leafDark")}
            >
              <Scale className="h-4 w-4" />
            </button>
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <li className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-vv-leafDark" />
              <span><strong>Next-morning delivery</strong><br /><span className="text-vv-mute">From 7:00 AM · ৳40 per order</span></span>
            </li>
            <li className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 text-vv-leafDark" />
              <span><strong>Checked before it&apos;s packed</strong><br /><span className="text-vv-mute">Inspected, graded, and weighed to your order</span></span>
            </li>
          </ul>

          <div className="mt-10 rounded-2xl border border-vv-line bg-white p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Per 100 g</h2>
            <dl className="grid grid-cols-4 gap-3 text-center">
              {[
                { l: "Calories", v: nutrition.calories, u: "kcal" },
                { l: "Carbs", v: nutrition.carbs, u: "g" },
                { l: "Protein", v: nutrition.protein, u: "g" },
                { l: "Fiber", v: nutrition.fiber, u: "g" },
              ].map((n) => (
                <div key={n.l}>
                  <dt className="text-xs text-vv-mute">{n.l}</dt>
                  <dd className="font-display text-xl font-semibold text-vv-ink">
                    {n.v}
                    <span className="text-xs text-vv-mute">{n.u}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <ExperimentExposure experiment="related_product_ranking_v1" />
          <h2 className="mb-6 font-display text-2xl font-semibold sm:text-3xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {displayedRelated.map((r, i) => (
              <ProductCard key={r.id} p={r} index={i} placement="recommendation" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
