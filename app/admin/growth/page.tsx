import { notFound } from "next/navigation";

import {
  emptyGrowthDashboardData,
  getGrowthDashboardData,
} from "@/lib/growth/queries";
import { GrowthDashboard } from "./GrowthDashboard";

export const dynamic = "force-dynamic";

export default async function GrowthPage() {
  try {
    return <GrowthDashboard data={await getGrowthDashboardData()} />;
  } catch (error) {
    if (error instanceof Error && error.message === "Admin only") notFound();

    return (
      <GrowthDashboard
        data={emptyGrowthDashboardData()}
        dbError="Growth analytics are unavailable. Check DATABASE_URL and run the seed."
      />
    );
  }
}
