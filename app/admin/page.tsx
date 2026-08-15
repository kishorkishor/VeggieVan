import { orderStats, recentOrders } from "@/lib/orders/queries";
import { lowStockCount } from "@/lib/products/queries";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 10;

export default async function AdminDashboardPage() {
  let stats: Awaited<ReturnType<typeof orderStats>> = {
    total: 0,
    pending: 0,
    revenue: 0,
  };
  let recent: Awaited<ReturnType<typeof recentOrders>> = [];
  let lowStock = 0;
  let dbError: string | null = null;

  try {
    [stats, recent, lowStock] = await Promise.all([
      orderStats(),
      recentOrders(6),
      lowStockCount(LOW_STOCK_THRESHOLD),
    ]);
  } catch (e) {
    console.error("dashboard fetch failed:", e);
    dbError =
      "Could not connect to the database. Set DATABASE_URL in .env.local and run `npm run db:push && npm run db:seed`.";
  }

  return (
    <DashboardClient
      stats={stats}
      recent={recent}
      lowStock={lowStock}
      lowStockThreshold={LOW_STOCK_THRESHOLD}
      dbError={dbError}
    />
  );
}
