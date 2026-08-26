import { DashboardApp } from "@/components/dashboard-app";
import { getDashboardData } from "@/lib/data/dashboard";
import { isDemoMode } from "@/lib/env";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isDemoMode()) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
  }
  const data = await getDashboardData();
  return <DashboardApp data={data} />;
}
