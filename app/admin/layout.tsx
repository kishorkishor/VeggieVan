"use client";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <div className="min-h-screen bg-vv-cream">{children}</div>;
  }

  // Middleware already enforces auth; this is just a render-time guard so we
  // don't flash protected UI before the session resolves.
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-vv-cream text-sm text-vv-mute">
        Loading admin…
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="flex min-h-screen bg-vv-cream">
      <AdminSidebar />
      <div className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
