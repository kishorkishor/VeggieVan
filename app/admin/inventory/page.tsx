import { auth } from "@/auth";
import { listProducts } from "@/lib/products/queries";
import { Forbidden } from "@/components/admin/RoleGate";
import { InventoryClient } from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function AdminInventoryPage() {
  const session = await auth();
  // Middleware should have already stopped staff from getting here, but
  // defense in depth: the page itself refuses to render the data for them.
  if (session?.user?.role !== "admin") {
    return <Forbidden message="Inventory is restricted to admin users." />;
  }

  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let dbError: string | null = null;
  try {
    products = await listProducts();
  } catch (e) {
    console.error("listProducts failed:", e);
    dbError =
      "Could not connect to the database. Set DATABASE_URL in .env.local and run `npm run db:push && npm run db:seed`.";
  }

  return <InventoryClient initialProducts={products} dbError={dbError} />;
}
