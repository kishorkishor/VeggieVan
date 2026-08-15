"use client";
import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { AlertTriangle, Database, RotateCcw, Search } from "lucide-react";
import {
  resetAllProductsAction,
  resetProductAction,
  updateProductAction,
} from "@/lib/products/actions";
import { formatBDT, cn } from "@/lib/utils";
import type { ProductRow } from "@/lib/products/queries";
import type { Category } from "@prisma/client";

const LOW_STOCK = 10;
const CATEGORIES: ("all" | Category)[] = ["all", "essentials", "vegetables", "baskets"];

export function InventoryClient({
  initialProducts,
  dbError,
}: {
  initialProducts: ProductRow[];
  dbError: string | null;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("all");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => cat === "all" || p.category === cat)
      .filter((p) =>
        !q
          ? true
          : p.name.toLowerCase().includes(q) ||
            p.tags.join(" ").toLowerCase().includes(q)
      );
  }, [products, query, cat]);

  function applyPatch(id: string, patch: Partial<ProductRow>) {
    // Optimistic — apply locally then sync.
    const before = products;
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
    startTransition(async () => {
      const res = await updateProductAction({
        id,
        // Only forward the patchable fields.
        patch: {
          stock: patch.stock,
          price: patch.price,
          organic: patch.organic,
          featured: patch.featured,
          inSeason: patch.inSeason,
        },
      });
      if (!res.ok) {
        setProducts(before);
        alert(res.error);
      }
    });
  }

  function applyReset(id: string) {
    startTransition(async () => {
      const res = await resetProductAction(id);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      // The action revalidates the path, but our local state is stale —
      // a quick re-fetch via location.reload would lose scroll. Easiest: do
      // nothing here and rely on the next navigation. For demo polish, just
      // clear local edits visually by reloading on success.
      window.location.reload();
    });
  }

  function applyResetAll() {
    if (!confirm("Reset all inventory edits to seed values?")) return;
    startTransition(async () => {
      const res = await resetAllProductsAction();
      if (!res.ok) {
        alert(res.error);
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-vv-mute">{filtered.length} items</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={applyResetAll} className="btn-outline text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Reset all
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vv-mute" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="input pl-9 sm:w-72"
            />
          </div>
        </div>
      </div>

      {dbError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-vv-orange/30 bg-vv-orange/5 px-4 py-3 text-sm text-vv-orange">
          <Database className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium text-vv-ink">Database not connected</div>
            <div className="mt-0.5 text-vv-ink/70">{dbError}</div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn("chip capitalize", cat === c && "chip-active")}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-vv-cream/60 text-left text-xs uppercase tracking-wide text-vv-mute">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price (৳)</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const low = p.stock <= LOW_STOCK;
                return (
                  <tr key={p.id} className="border-t border-vv-line">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 overflow-hidden rounded-lg">
                          <Image
                            src={p.images[0]}
                            alt={p.name}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-vv-mute">{p.unit}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize text-vv-mute">{p.category}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={(p.price / 100).toFixed(2)}
                        onBlur={(e) => {
                          const cents = Math.round(parseFloat(e.target.value || "0") * 100);
                          if (!Number.isFinite(cents) || cents < 0 || cents === p.price) return;
                          applyPatch(p.id, { price: cents });
                        }}
                        className="w-24 rounded-lg border border-vv-line bg-white px-2 py-1 text-sm outline-none focus:border-vv-leaf"
                      />
                      <div className="mt-0.5 text-[11px] text-vv-mute">
                        {formatBDT(p.price)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={p.stock}
                          onChange={(e) => {
                            const n = parseInt(e.target.value || "0", 10);
                            if (!Number.isFinite(n) || n < 0) return;
                            applyPatch(p.id, { stock: n });
                          }}
                          className={cn(
                            "w-20 rounded-lg border bg-white px-2 py-1 text-sm outline-none focus:border-vv-leaf",
                            low ? "border-vv-red/40 text-vv-red" : "border-vv-line"
                          )}
                        />
                        {low && <AlertTriangle className="h-4 w-4 text-vv-red" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <FlagToggle
                          label="Organic"
                          on={p.organic}
                          onChange={(v) => applyPatch(p.id, { organic: v })}
                        />
                        <FlagToggle
                          label="In season"
                          on={p.inSeason}
                          onChange={(v) => applyPatch(p.id, { inSeason: v })}
                        />
                        <FlagToggle
                          label="Featured"
                          on={p.featured}
                          onChange={(v) => applyPatch(p.id, { featured: v })}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => applyReset(p.id)}
                        className="rounded-lg p-1.5 text-vv-mute transition hover:bg-vv-ink/5 hover:text-vv-ink"
                        title="Reset to seed"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FlagToggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "rounded-full border px-2.5 py-0.5 transition",
        on
          ? "border-vv-leaf bg-vv-leaf/10 text-vv-leafDark"
          : "border-vv-line bg-white text-vv-mute hover:border-vv-leaf/50"
      )}
    >
      {label}
    </button>
  );
}
