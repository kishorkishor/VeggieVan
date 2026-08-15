"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Database, Shield, Trash2, User as UserIcon, UserPlus } from "lucide-react";
import type { User } from "@prisma/client";
import { useIsAdmin } from "@/lib/session-helpers";
import { Forbidden } from "@/components/admin/RoleGate";
import {
  createUserAction,
  deleteUserAction,
  setUserRoleAction,
} from "@/lib/users/actions";
import { cn } from "@/lib/utils";

// Slim projection — the page must never pass passwordHash to the client.
export type AdminUser = Pick<User, "id" | "email" | "name" | "role" | "createdAt">;

const EMPTY_FORM = { name: "", email: "", password: "", role: "staff" as "admin" | "staff" };

export function UsersClient({
  users,
  dbError,
  currentEmail,
}: {
  users: AdminUser[];
  dbError: string | null;
  currentEmail: string | null;
}) {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  if (!isAdmin) return <Forbidden message="User management is admin-only." />;

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const res = await createUserAction(form);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      setForm(EMPTY_FORM);
      router.refresh();
    });
  };

  const changeRole = (id: string, role: "admin" | "staff") => {
    setRowError(null);
    startTransition(async () => {
      const res = await setUserRoleAction({ id, role });
      if (!res.ok) {
        setRowError({ id, message: res.error });
        return;
      }
      router.refresh();
    });
  };

  const removeUser = (u: AdminUser) => {
    if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await deleteUserAction(u.id);
      if (!res.ok) {
        setRowError({ id: u.id, message: res.error });
        return;
      }
      router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-vv-mute">
          Admin and staff accounts, persisted in Postgres. Passwords are
          bcrypt-hashed. Role changes take effect at the user&apos;s next sign-in.
        </p>
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

      {!dbError && (
        <form onSubmit={submitCreate} className="card mb-6 p-5">
          <div className="mb-3 flex items-center gap-2 font-medium">
            <UserPlus className="h-4 w-4 text-vv-leafDark" /> Add a user
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="new-user-name">Name</label>
              <input
                id="new-user-name"
                className="input"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="new-user-email">Email</label>
              <input
                id="new-user-email"
                className="input"
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="new-user-password">Password (8+ chars)</label>
              <input
                id="new-user-password"
                className="input"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="new-user-role">Role</label>
              <select
                id="new-user-role"
                className="input"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as "admin" | "staff" }))
                }
              >
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          {formError && <p className="mt-2 text-xs text-vv-red">{formError}</p>}
          <button type="submit" className="btn-primary mt-4 text-sm">
            Create user
          </button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {users.map((u) => {
          const isMe = currentEmail === u.email;
          const Icon = u.role === "admin" ? Shield : UserIcon;
          return (
            <div
              key={u.email}
              className={cn("card p-5", isMe && "ring-2 ring-vv-leaf")}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      u.role === "admin"
                        ? "bg-vv-leaf/10 text-vv-leafDark"
                        : "bg-vv-yellow/25 text-vv-ink"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{u.name ?? u.email}</div>
                    <div className="text-xs text-vv-mute">{u.email}</div>
                  </div>
                </div>
                {isMe && (
                  <span className="rounded-full bg-vv-leaf/10 px-2 py-0.5 text-[11px] font-medium text-vv-leafDark">
                    You
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <select
                  aria-label={`Role for ${u.email}`}
                  className="rounded-full border border-vv-line bg-white px-2 py-0.5 text-xs capitalize text-vv-ink disabled:cursor-not-allowed disabled:text-vv-mute"
                  value={u.role}
                  disabled={isMe}
                  title={isMe ? "You cannot change your own role" : undefined}
                  onChange={(e) => changeRole(u.id, e.target.value as "admin" | "staff")}
                >
                  <option value="admin">admin</option>
                  <option value="staff">staff</option>
                </select>
                <span className="flex-1 text-xs text-vv-mute">
                  {u.role === "admin"
                    ? "Full access — inventory, orders, users"
                    : "Orders only — can update statuses"}
                </span>
                <button
                  aria-label={`Delete ${u.email}`}
                  onClick={() => removeUser(u)}
                  disabled={isMe}
                  title={isMe ? "You cannot delete your own account" : undefined}
                  className="rounded-full p-1.5 text-vv-mute hover:bg-vv-red/10 hover:text-vv-red disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-vv-mute"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {rowError?.id === u.id && (
                <p className="mt-2 text-xs text-vv-red">{rowError.message}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
