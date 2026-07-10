import { redirect } from "next/navigation";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { summarizeDashboard } from "@/domain/dashboard";
import { fetchDashboardInput } from "@/server/repositories/dashboard";
import { listClientMonitor, listComplianceRiskItems } from "@/server/repositories/dashboard-extras";
import { getCurrentUser } from "@/server/session";

const businessTimeZone = "Asia/Seoul";

function getBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const today = getBusinessDate();
  const [dashboardInput, riskItems, clientMonitor] = await Promise.all([
    fetchDashboardInput(user, { today, timeZone: businessTimeZone }),
    listComplianceRiskItems(user),
    listClientMonitor(user, today)
  ]);
  const summary = summarizeDashboard(dashboardInput);

  return (
    <DashboardHome
      userName={user.name}
      role={user.role}
      summary={summary}
      riskItems={riskItems}
      clientMonitor={clientMonitor}
    />
  );
}
