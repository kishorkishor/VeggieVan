import "server-only";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

export type { Role } from "@prisma/client";

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// Map a Google OAuth email to an admin/staff role (or null if not found).
// Users are now stored in the database — add rows there to grant access.
export async function roleForGoogleEmail(
  email: string | null | undefined
): Promise<Role | null> {
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { role: true },
  });
  return user?.role ?? null;
}
