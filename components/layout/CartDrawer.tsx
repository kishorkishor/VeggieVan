"use client";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Minus, Plus, Trash2, X, ShoppingBasket, ArrowRight } from "lucide-react";
import { useCart, cartTotals } from "@/lib/stores";
import { useCatalog } from "@/lib/catalog-context";
import { formatBDT } from "@/lib/utils";
import { DELIVERY_CHARGE } from "@/lib/cart-math";

export function CartDrawer() {
  const pathname = usePathname();
  const { items, drawerOpen, closeDrawer, setQty, remove } = useCart();
  const products = useCatalog();
  if (pathname?.startsWith("/admin")) return null;
  const { subtotal, shipping, total } = cartTotals(items, products);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-vv-ink/40 backdrop-blur-sm"
            onClick={closeDrawer}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col bg-vv-cream shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-vv-line px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="h-5 w-5 text-vv-leafDark" />
                <h2 className="font-display text-xl">Your basket</h2>
              </div>
              <button
                onClick={closeDrawer}
                aria-label="Close"
                className="rounded-full p-2 hover:bg-vv-ink/5"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            {subtotal > 0 && (
              <p className="border-b border-vv-line px-5 py-3 text-xs text-vv-mute">
                {formatBDT(DELIVERY_CHARGE)} delivery per order · at your door from 7:00 AM
              </p>
            )}

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="text-6xl">🧺</div>
                  <div>
                    <div className="font-display text-lg">Your basket is empty</div>
                    <p className="text-sm text-vv-mute">Fresh produce is just a click away.</p>
                  </div>
                  <Link href="/products" onClick={closeDrawer} className="btn-primary">
                    Start shopping
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-vv-line">
                  <AnimatePresence initial={false}>
                    {items.map((item) => {
                      const p = products.find((x) => x.id === item.productId);
                      if (!p) return null;
                      return (
                        <motion.li
                          key={item.productId}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                          className="flex gap-3 p-4"
                        >
                          <Link
                            href={`/products/${p.slug}`}
                            onClick={closeDrawer}
                            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white"
                          >
                            <Image
                              src={p.images[0]}
                              alt={p.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </Link>
                          <div className="flex flex-1 flex-col">
                            <div className="flex justify-between gap-2">
                              <div>
                                <div className="font-medium leading-tight">{p.name}</div>
                                <div className="text-xs text-vv-mute">{p.unit}</div>
                              </div>
                              <div className="text-right font-medium">
                                {formatBDT(p.price * item.qty)}
                              </div>
                            </div>
                            <div className="mt-auto flex items-center justify-between">
                              <QtyStepper
                                value={item.qty}
                                onDec={() => setQty(p.id, item.qty - 1)}
                                onInc={() => setQty(p.id, item.qty + 1)}
                                incDisabled={item.qty >= p.stock}
                              />
                              <button
                                onClick={() => remove(p.id)}
                                className="rounded-full p-1.5 text-vv-mute hover:bg-vv-red/10 hover:text-vv-red"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <footer className="border-t border-vv-line bg-white px-5 py-4">
                <dl className="mb-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-vv-mute">Subtotal</dt>
                    <dd>{formatBDT(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-vv-mute">Delivery</dt>
                    <dd>{formatBDT(shipping)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-vv-line pt-2 text-base font-semibold">
                    <dt>Total</dt>
                    <dd>{formatBDT(total)}</dd>
                  </div>
                </dl>
                <Link
                  href="/checkout"
                  onClick={closeDrawer}
                  className="btn-primary w-full"
                >
                  Checkout
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function QtyStepper({
  value,
  onInc,
  onDec,
  incDisabled,
}: {
  value: number;
  onInc: () => void;
  onDec: () => void;
  incDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-vv-line bg-white">
      <button
        aria-label="Decrease"
        onClick={onDec}
        className="rounded-full p-1.5 hover:bg-vv-ink/5"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-medium tabular-nums">{value}</span>
      <button
        aria-label="Increase"
        onClick={onInc}
        disabled={incDisabled}
        title={incDisabled ? "No more stock available" : undefined}
        className="rounded-full p-1.5 hover:bg-vv-ink/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
