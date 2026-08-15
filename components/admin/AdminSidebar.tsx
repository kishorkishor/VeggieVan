"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LogOut,
  Leaf,
} from "lucide-react";
import { getAdminNavItems } from "@/components/admin/adminNavigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/admin-users";

export function AdminSidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const user = data?.user;

  if (!user || !user.role) return null;
  const role = user.role as Role;
  const visible = getAdminNavItems(role);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-vv-line bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-vv-leaf text-white">
          <Leaf className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg font-semibold leading-none">VeggieVan</div>
          <div className="text-[11px] uppercase tracking-wider text-vv-mute">Admin</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visible.map((n) => {
          const active =
            n.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-vv-leaf/10 text-vv-leafDark"
                  : "text-vv-ink/70 hover:bg-vv-ink/5 hover:text-vv-ink"
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-vv-line p-3">
        <div className="px-2 pb-2">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-vv-mute capitalize">{role}</div>
          <div className="truncate text-[11px] text-vv-mute">{user.email}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-vv-ink/70 transition hover:bg-vv-red/10 hover:text-vv-red"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
