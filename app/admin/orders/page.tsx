import { listOrders } from "@/lib/orders/queries";
import { OrdersClient } from "./OrdersClient";

// Always render fresh — admin data is per-request, never static.
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  let orders: Awaited<ReturnType<typeof listOrders>> = [];
  let dbError: string | null = null;
  try {
    orders = await listOrders();
  } catch (e) {
    console.error("listOrders failed:", e);
    dbError =
      "Could not connect to the database. Set DATABASE_URL in .env.local and run `npm run db:push && npm run db:seed`.";
  }

  return <OrdersClient initialOrders={orders} dbError={dbError} />;
}
