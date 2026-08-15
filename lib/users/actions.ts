"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { ok: false as const, error: "Admin only" };
  }
  return { ok: true as const, email: session.user.email ?? null };
}

// Login lowercases + trims the email (lib/admin-users.ts), so stored emails
// must be normalized the same way or the user can never sign in.
const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "staff"]),
});

export async function createUserAction(
  input: z.infer<typeof createSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid user details (password must be 8+ characters)" };
  }
  const { name, email, password, role } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10); // cost matches prisma/seed.ts
    await prisma.user.create({ data: { name, email, passwordHash, role } });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return { ok: false, error: "A user with that email already exists" };
    }
    console.error("createUserAction failed:", e);
    return { ok: false, error: "Could not create user" };
  }
}

const roleSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["admin", "staff"]),
});

export async function setUserRoleAction(
  input: z.infer<typeof roleSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;

  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid role" };

  try {
    const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!target) return { ok: false, error: "User not found" };

    // Compare by email: for Google OAuth sign-ins the JWT id comes from the
    // provider profile, not the DB row.
    if (guard.email && target.email === guard.email) {
      return { ok: false, error: "You cannot change your own role" };
    }

    if (target.role === "admin" && parsed.data.role === "staff") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) return { ok: false, error: "Cannot demote the last admin" };
    }

    await prisma.user.update({
      where: { id: parsed.data.id },
      data: { role: parsed.data.role },
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    console.error("setUserRoleAction failed:", e);
    return { ok: false, error: "Update failed" };
  }
}

export async function deleteUserAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard;
  if (!id) return { ok: false, error: "Invalid user" };

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return { ok: false, error: "User not found" };

    if (guard.email && target.email === guard.email) {
      return { ok: false, error: "You cannot delete your own account" };
    }

    if (target.role === "admin") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) return { ok: false, error: "Cannot delete the last admin" };
    }

    await prisma.user.delete({ where: { id } });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    console.error("deleteUserAction failed:", e);
    return { ok: false, error: "Delete failed" };
  }
}
