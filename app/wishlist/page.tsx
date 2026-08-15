"use client";
import Link from "next/link";
import { useWishlist, useCart } from "@/lib/stores";
import { useCatalog } from "@/lib/catalog-context";
import { ProductCard } from "@/components/product/ProductCard";
import { Heart, ShoppingBasket } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

export default function WishlistPage() {
  const { ids, clear } = useWishlist();
  const add = useCart((s) => s.add);
  const products = useCatalog();
  const items = products.filter((p) => ids.includes(p.id));

  const moveAllToCart = () => {
    items.forEach((p) => add(p.id));
    toast(`Added ${items.length} items to basket`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            <Heart className="h-8 w-8 text-vv-red" /> Wishlist
          </h1>
          <p className="mt-1 text-sm text-vv-mute">
            {items.length} {items.length === 1 ? "item" : "items"} saved for later
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2">
            <button onClick={clear} className="btn-outline text-sm">Clear</button>
            <button onClick={moveAllToCart} className="btn-primary text-sm">
              <ShoppingBasket className="h-4 w-4" /> Add all to basket
            </button>
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-vv-line p-16 text-center">
          <div className="text-6xl">💚</div>
          <h2 className="mt-4 font-display text-2xl">Your wishlist is empty</h2>
          <p className="mt-2 max-w-sm text-sm text-vv-mute">
            Tap the heart on any product to save it for later.
          </p>
          <Link href="/products" className="btn-primary mt-5">Browse produce</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <ProductCard key={p.id} p={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
