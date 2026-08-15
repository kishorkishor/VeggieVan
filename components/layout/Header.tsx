"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Search, ShoppingBasket, Scale, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useCart, useWishlist, useCompare } from "@/lib/stores";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { href: "/products", label: "Shop" },
  { href: "/products?category=baskets", label: "Baskets" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#delivery-areas", label: "Delivery areas" },
  { href: "/#contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const cartCount = useCart((s) => s.items.reduce((a, i) => a + i.qty, 0));
  const toggleDrawer = useCart((s) => s.toggleDrawer);
  const wishlistCount = useWishlist((s) => s.ids.length);
  const compareCount = useCompare((s) => s.ids.length);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [elevated, setElevated] = useState(false);

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      {/* announcement strip */}
      <div className="bg-vv-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-1.5 text-xs tracking-wide">
          <span>Order window · 8:00 PM to 11:59 PM</span>
        </div>
      </div>

      <header
        className={`sticky top-0 z-40 border-b transition-all ${
          elevated
            ? "border-vv-line bg-vv-cream/80 backdrop-blur-lg"
            : "border-transparent bg-vv-cream"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-vv-ink/80 transition hover:bg-vv-leaf/10 hover:text-vv-leafDark"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button
              aria-label="Search"
              onClick={() => window.dispatchEvent(new CustomEvent("veggievan:open-search"))}
              className="hidden items-center gap-2 rounded-full border border-vv-line bg-white px-3 py-2 text-xs text-vv-mute transition hover:border-vv-leaf md:inline-flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search vegetables…</span>
              <kbd className="ml-3 rounded bg-vv-ink/5 px-1.5 py-0.5 text-[10px] font-medium text-vv-ink/60">
                ⌘K
              </kbd>
            </button>
            <button
              aria-label="Search"
              onClick={() => window.dispatchEvent(new CustomEvent("veggievan:open-search"))}
              className="rounded-full p-2 text-vv-ink hover:bg-vv-ink/5 md:hidden"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link
              href="/compare"
              aria-label="Compare"
              className="relative rounded-full p-2 text-vv-ink hover:bg-vv-ink/5"
            >
              <Scale className="h-5 w-5" />
              <Badge n={compareCount} />
            </Link>
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="relative rounded-full p-2 text-vv-ink hover:bg-vv-ink/5"
            >
              <Heart className="h-5 w-5" />
              <Badge n={wishlistCount} />
            </Link>
            <button
              aria-label="Cart"
              onClick={toggleDrawer}
              className="relative rounded-full p-2 text-vv-ink hover:bg-vv-ink/5"
            >
              <ShoppingBasket className="h-5 w-5" />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-vv-red px-1 text-[10px] font-bold text-white shadow-sm"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <button
              aria-label="Menu"
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-full p-2 text-vv-ink hover:bg-vv-ink/5 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-vv-line bg-vv-cream md:hidden"
            >
              <div className="flex flex-col px-4 py-2">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setMobileOpen(false)}
                    className="py-3 text-base font-medium text-vv-ink"
                  >
                    {n.label}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-vv-leaf px-1 text-[10px] font-bold text-white">
      {n}
    </span>
  );
}
