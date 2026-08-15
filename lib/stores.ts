"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DELIVERY_CHARGE, shippingFor } from "@/lib/cart-math";

// ---- CART ----
export type CartItem = { productId: string; qty: number };
type CartState = {
  items: CartItem[];
  drawerOpen: boolean;
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      drawerOpen: false,
      add: (id, qty = 1) => {
        const existing = get().items.find((i) => i.productId === id);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.productId === id ? { ...i, qty: i.qty + qty } : i
            ),
            drawerOpen: true,
          });
        } else {
          set({ items: [...get().items, { productId: id, qty }], drawerOpen: true });
        }
      },
      remove: (id) => set({ items: get().items.filter((i) => i.productId !== id) }),
      setQty: (id, qty) =>
        set({
          items: qty <= 0
            ? get().items.filter((i) => i.productId !== id)
            : get().items.map((i) => (i.productId === id ? { ...i, qty } : i)),
        }),
      clear: () => set({ items: [] }),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
      toggleDrawer: () => set({ drawerOpen: !get().drawerOpen }),
    }),
    { name: "veggievan-cart", partialize: (s) => ({ items: s.items }) }
  )
);

// ---- WISHLIST ----
type WishlistState = {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
};
export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set({
          ids: get().ids.includes(id)
            ? get().ids.filter((x) => x !== id)
            : [...get().ids, id],
        }),
      has: (id) => get().ids.includes(id),
      clear: () => set({ ids: [] }),
    }),
    { name: "veggievan-wishlist" }
  )
);

// ---- COMPARE ----
type CompareState = {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
};
export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) => {
        const ids = get().ids;
        if (ids.includes(id)) set({ ids: ids.filter((x) => x !== id) });
        else if (ids.length < 4) set({ ids: [...ids, id] });
      },
      has: (id) => get().ids.includes(id),
      remove: (id) => set({ ids: get().ids.filter((x) => x !== id) }),
      clear: () => set({ ids: [] }),
    }),
    { name: "veggievan-compare" }
  )
);

// Orders moved to Postgres via Prisma. See:
//   prisma/schema.prisma            - Order / OrderItem / OrderStatus
//   lib/orders/queries.ts           - server reads
//   lib/orders/actions.ts           - place / setStatus / remove (Server Actions)

// Inventory moved to Postgres via Prisma. See:
//   prisma/schema.prisma            - Product model
//   lib/products/queries.ts         - server reads (listProducts, lowStockCount)
//   lib/products/actions.ts         - update / reset / decrement (Server Actions)

// ---- Helpers ----
export function cartTotals(
  items: CartItem[],
  products: { id: string; price: number }[]
) {
  let subtotal = 0;
  let count = 0;
  for (const i of items) {
    const p = products.find((x) => x.id === i.productId);
    if (!p) continue;
    subtotal += p.price * i.qty;
    count += i.qty;
  }
  const shipping = shippingFor(subtotal);
  const total = subtotal + shipping;
  return { subtotal, shipping, total, count, DELIVERY_CHARGE };
}
