import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UsersClient, type AdminUser } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();

  let users: AdminUser[] = [];
  let dbError: string | null = null;
  try {
    // Explicit select: never ship passwordHash to the client.
    users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  } catch (e) {
    console.error("listUsers failed:", e);
    dbError =
      "Could not connect to the database. Set DATABASE_URL in .env.local and run `npm run db:push && npm run db:seed`.";
  }

  return (
    <UsersClient
      users={users}
      dbError={dbError}
      currentEmail={session?.user?.email ?? null}
    />
  );
}
