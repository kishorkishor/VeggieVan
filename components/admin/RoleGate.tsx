"use client";
import { useRole } from "@/lib/session-helpers";
import type { Role } from "@/lib/admin-users";
import { ShieldAlert } from "lucide-react";

export function RoleGate({
  allow,
  fallback = null,
  children,
}: {
  allow: Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const role = useRole();
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

export function Forbidden({ message }: { message?: string }) {
  return (
    <div className="card mx-auto mt-8 max-w-md p-8 text-center">
      <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-vv-red" />
      <h2 className="font-display text-2xl font-semibold">Forbidden</h2>
      <p className="mt-1 text-sm text-vv-mute">
        {message ?? "Your role doesn't have access to this section."}
      </p>
    </div>
  );
}
