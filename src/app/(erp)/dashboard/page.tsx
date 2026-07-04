import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { DashboardInbox } from "@/components/dashboard/DashboardInbox";
import { MarketerDashboard } from "@/components/dashboard/MarketerDashboard";
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { summarizeDashboard } from "@/domain/dashboard";
import { Role } from "@/domain/types";
import { fetchDashboardInput } from "@/server/repositories/dashboard";
import { getInboxSummary } from "@/server/repositories/inbox";
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

  const dashboardInput = await fetchDashboardInput(user, {
    today: getBusinessDate(),
    timeZone: businessTimeZone
  });
  const summary = summarizeDashboard(dashboardInput);
  const inbox = await getInboxSummary(user);

  const roleDashboard =
    user.role === Role.SUPER_ADMIN ? (
      <SuperAdminDashboard summary={summary} />
    ) : user.role === Role.ADMIN ? (
      <AdminDashboard summary={summary} />
    ) : (
      <MarketerDashboard summary={summary} />
    );

  return (
    <div className="space-y-8">
      {roleDashboard}
      <DashboardInbox inbox={inbox} />
    </div>
  );
}
