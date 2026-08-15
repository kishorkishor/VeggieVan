import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";

import type { Role } from "@/lib/admin-users";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "staff"] },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, roles: ["admin", "staff"] },
  { href: "/admin/growth", label: "Growth", icon: TrendingUp, roles: ["admin"] },
  { href: "/admin/inventory", label: "Inventory", icon: Package, roles: ["admin"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["admin"] },
];

export function getAdminNavItems(role: Role) {
  return ADMIN_NAV_ITEMS.filter((item) => item.roles.includes(role));
}
