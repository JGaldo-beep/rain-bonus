import { getOverview } from "../lib/api";
import { DashboardClient } from "../components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const zones = await getOverview();
  return <DashboardClient initial={zones} />;
}
