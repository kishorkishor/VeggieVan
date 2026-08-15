"use client";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, Scale } from "lucide-react";
import { useCompare } from "@/lib/stores";
import { useCatalog } from "@/lib/catalog-context";

export function CompareTray() {
  const pathname = usePathname();
  const { ids, remove, clear } = useCompare();
  const products = useCatalog();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <AnimatePresence>
      {ids.length > 0 && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center gap-3 rounded-2xl border border-vv-line bg-white p-3 shadow-lift"
        >
          <div className="hidden items-center gap-2 border-r border-vv-line pr-3 text-sm font-medium sm:flex">
            <Scale className="h-4 w-4 text-vv-leafDark" /> Compare
          </div>
          <div className="flex flex-1 gap-2 overflow-x-auto scroll-hide">
            {ids.map((id) => {
              const p = products.find((x) => x.id === id);
              if (!p) return null;
              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative flex shrink-0 items-center gap-2 rounded-xl bg-vv-cream px-2 py-1.5"
                >
                  <div className="relative h-8 w-8 overflow-hidden rounded-md">
                    <Image src={p.images[0]} alt={p.name} fill sizes="32px" className="object-cover" />
                  </div>
                  <span className="max-w-[120px] truncate text-xs font-medium">{p.name}</span>
                  <button
                    onClick={() => remove(id)}
                    className="rounded-full p-0.5 text-vv-mute hover:bg-vv-ink/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              );
            })}
            {Array.from({ length: Math.max(0, 2 - ids.length) }).map((_, i) => (
              <div
                key={i}
                className="grid h-11 w-[100px] shrink-0 place-items-center rounded-xl border border-dashed border-vv-line text-xs text-vv-mute"
              >
                Add more
              </div>
            ))}
          </div>
          <button onClick={clear} className="btn-ghost hidden text-xs sm:inline-flex">
            Clear
          </button>
          <Link href="/compare" className="btn-primary text-xs">
            Compare {ids.length}
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
