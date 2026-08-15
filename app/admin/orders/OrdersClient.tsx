"use client";
import { useMemo, useRef, useEffect, useState, useTransition } from "react";
import { Database, Search, Trash2, X } from "lucide-react";
import { useIsAdmin } from "@/lib/session-helpers";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { formatBDT, cn } from "@/lib/utils";
import { removeOrderAction, setOrderStatusAction } from "@/lib/orders/actions";
import type { OrderWithItems } from "@/lib/orders/queries";
import type { OrderStatus } from "@prisma/client";

const STATUSES: (OrderStatus | "all")[] = [
  "all",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export function OrdersClient({
  initialOrders,
  dbError,
}: {
  initialOrders: OrderWithItems[];
  dbError: string | null;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<OrderWithItems | null>(null);
  const [, startTransition] = useTransition();
  const isAdmin = useIsAdmin();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => filter === "all" || o.status === filter)
      .filter((o) =>
        !q
          ? true
          : o.id.toLowerCase().includes(q) ||
            o.customerName.toLowerCase().includes(q) ||
            o.customerPhone.includes(q) ||
            o.customerZone.toLowerCase().includes(q) ||
            (o.customerEmail?.toLowerCase().includes(q) ?? false)
      );
  }, [orders, filter, query]);

  const activeFresh = active
    ? orders.find((o) => o.id === active.id) ?? null
    : null;

  function applyStatus(id: string, status: OrderStatus) {
    // Optimistic update for snappier UX; reconciled by revalidatePath.
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o))
    );
    startTransition(async () => {
      const res = await setOrderStatusAction({ id, status });
      if (!res.ok) {
        // Roll back on failure.
        setOrders(initialOrders);
        alert(res.error);
      }
    });
  }

  function applyDelete(id: string) {
    if (!confirm(`Delete order ${id}?`)) return;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    startTransition(async () => {
      const res = await removeOrderAction(id);
      if (!res.ok) {
        setOrders(initialOrders);
        alert(res.error);
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-vv-mute">
            {filtered.length} of {orders.length} orders
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vv-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders…"
            className="input pl-9 sm:w-72"
          />
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
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn("chip capitalize", filter === s && "chip-active")}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-vv-cream/60 text-left text-xs uppercase tracking-wide text-vv-mute">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-vv-mute">
                    No orders match this filter.
                  </td>
                </tr>
              )}
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  className="cursor-pointer border-t border-vv-line transition hover:bg-vv-cream/50"
                  onClick={() => setActive(o)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-vv-mute">{o.id}</td>
                  <td className="px-4 py-3 text-vv-mute">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-xs text-vv-mute">
                      {o.customerPhone} · {o.customerZone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {o.items.reduce((a, i) => a + i.qty, 0)}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatBDT(o.total)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={o.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => applyStatus(o.id, e.target.value as OrderStatus)}
                      className="rounded-lg border border-vv-line bg-white px-2 py-1 text-xs capitalize outline-none focus:border-vv-leaf"
                    >
                      {STATUSES.filter((s) => s !== "all").map((s) => (
                        <option key={s} value={s} className="capitalize">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          applyDelete(o.id);
                        }}
                        className="rounded-lg p-1.5 text-vv-mute transition hover:bg-vv-red/10 hover:text-vv-red"
                        aria-label="Delete order"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeFresh && (
        <OrderDrawer
          order={activeFresh}
          onClose={() => setActive(null)}
          onStatus={(status) => applyStatus(activeFresh.id, status)}
        />
      )}
    </div>
  );
}

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

function trapFocus(container: HTMLElement, e: KeyboardEvent) {
  const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

function OrderDrawer({
  order,
  onClose,
  onStatus,
}: {
  order: OrderWithItems;
  onClose: () => void;
  onStatus: (s: OrderStatus) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => { (returnFocusRef.current as HTMLElement)?.focus?.(); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab" && containerRef.current) trapFocus(containerRef.current, e.nativeEvent);
      }}
    >
      <div className="absolute inset-0 bg-vv-ink/40" />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-drawer-title"
        className="relative h-full w-full max-w-md overflow-y-auto bg-white shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-vv-line p-5">
          <div>
            <div className="font-mono text-xs text-vv-mute">{order.id}</div>
            <h2 id="order-drawer-title" className="font-display text-xl font-semibold">{order.customerName}</h2>
            <div className="mt-1 text-xs text-vv-mute">
              {new Date(order.createdAt).toLocaleString()}
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="rounded-lg p-1.5 text-vv-mute hover:bg-vv-ink/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <div className="label">Status</div>
            <div className="flex items-center gap-3">
              <OrderStatusBadge status={order.status} />
              <select
                value={order.status}
                onChange={(e) => onStatus(e.target.value as OrderStatus)}
                className="rounded-lg border border-vv-line bg-white px-2 py-1 text-xs capitalize outline-none focus:border-vv-leaf"
              >
                {(["pending", "processing", "shipped", "delivered", "cancelled"] as OrderStatus[]).map(
                  (s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <div className="label">Customer</div>
            <div className="text-sm">{order.customerName}</div>
            <div className="text-sm text-vv-mute">{order.customerPhone}</div>
            {order.customerEmail ? (
              <div className="text-sm text-vv-mute">{order.customerEmail}</div>
            ) : null}
            <div className="mt-2 text-sm">
              {order.customerAddress}
              <br />
              {order.customerZone}, Dhaka
            </div>
          </div>

          <div>
            <div className="label">Items</div>
            <ul className="space-y-2">
              {order.items.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between rounded-xl border border-vv-line bg-vv-cream/40 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-vv-mute">
                      {i.qty} × {formatBDT(i.price)}
                    </div>
                  </div>
                  <div className="font-medium">{formatBDT(i.qty * i.price)}</div>
                </li>
              ))}
            </ul>
          </div>

          <dl className="space-y-1 border-t border-vv-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-vv-mute">Subtotal</dt>
              <dd>{formatBDT(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-vv-mute">Shipping</dt>
              <dd>{order.shipping === 0 ? "Free" : formatBDT(order.shipping)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-vv-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatBDT(order.total)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
