"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { CATEGORIES, UNITS } from "@/data/products";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Filters() {
  const router = useRouter();
  const sp = useSearchParams();

  const set = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(sp.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      router.replace(`/products?${params.toString()}`, { scroll: false });
    },
    [router, sp]
  );

  const category = sp.get("category") || "";
  const unit = sp.get("unit") || "";
  const maxPrice = sp.get("maxPrice");

  const clear = () => router.replace("/products", { scroll: false });
  const any = category || unit || maxPrice;

  return (
    <div className="space-y-6">
      <Section title="Category">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => set("category", null)}
            className={cn("chip", !category && "chip-active")}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => set("category", category === c.id ? null : c.id)}
              className={cn("chip", category === c.id && "chip-active")}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sold by">
        <div className="flex flex-wrap gap-2">
          {UNITS.map((u) => (
            <button
              key={u}
              onClick={() => set("unit", unit === u ? null : u)}
              className={cn("chip", unit === u && "chip-active")}
            >
              {u}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Price">
        <input
          type="range"
          min={2000}
          max={32000}
          step={1000}
          value={maxPrice ? Number(maxPrice) : 32000}
          onChange={(e) =>
            set("maxPrice", e.target.value === "32000" ? null : e.target.value)
          }
          className="w-full accent-vv-leafDark"
        />
        <div className="flex justify-between text-xs text-vv-mute">
          <span>৳20</span>
          <span>
            {maxPrice ? `up to ৳${(Number(maxPrice) / 100).toFixed(0)}` : "up to ৳320"}
          </span>
        </div>
      </Section>

      {any && (
        <button
          onClick={clear}
          className="flex w-full items-center justify-center gap-1 rounded-xl border border-vv-line py-2 text-xs text-vv-mute hover:border-vv-red hover:text-vv-red"
        >
          <X className="h-3 w-3" /> Clear all
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-vv-mute">
        {title}
      </div>
      {children}
    </div>
  );
}
