"use client";
import { useSession } from "next-auth/react";
import type { Role } from "@/lib/admin-users";

export function useCurrentUser() {
  const { data, status } = useSession();
  return { user: data?.user ?? null, status };
}

export function useRole(): Role | null {
  const { data } = useSession();
  return (data?.user?.role as Role | undefined) ?? null;
}

export function useIsAdmin() {
  return useRole() === "admin";
}

export function useIsStaff() {
  return useRole() === "staff";
}
