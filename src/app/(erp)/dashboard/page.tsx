import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { SearchEngineNotices, SearchNoticesSkeleton } from "@/components/dashboard/SearchEngineNotices";
import { summarizeDashboard, type DashboardSummary } from "@/domain/dashboard";
import { fetchDashboardInput } from "@/server/repositories/dashboard";
import { listClientConfirmations, listClientMonitor, listComplianceRiskItems } from "@/server/repositories/dashboard-extras";
import { geoDashboardSummary } from "@/server/repositories/geo";
import { listInsightClients } from "@/server/repositories/insights";
import { leadPipelineSummary } from "@/server/repositories/leads";
import { getCurrentUser } from "@/server/session";

const businessTimeZone = "Asia/Seoul";

const ZERO_SUMMARY: DashboardSummary = {
  totalWorkCount: 0,
  completedWorkCount: 0,
  delayedWorkCount: 0,
  reviewNeededWorkCount: 0,
  todayWorkCount: 0,
  reportTaskCount: 0,
  upcomingDeadlineCount: 0,
  unpaidAmount: 0,
  expenseTotal: 0,
  pendingLeaveCount: 0,
  assignedClientCount: 0,
  leaveBalanceDays: 0
};

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
  // 방어적: 인증 랜딩(대시보드)은 흰 500으로 죽지 않게 각 조회를 독립 강등한다.
  // 한 위젯의 조회 실패가 전체 화면을 막지 않고, 실패한 부분만 빈 상태로 보인다.
  const [dashboardInput, riskItems, clientMonitor, confirmations, leadPipeline, geoSummary] = await Promise.all([
    fetchDashboardInput(user, { today, timeZone: businessTimeZone }).catch(() => null),
    listComplianceRiskItems(user).catch(() => []),
    listClientMonitor(user, today).catch(() => []),
    listClientConfirmations(user).catch(() => ({ pending: [], recent: [] })),
    leadPipelineSummary(user).catch(() => ({ byStatus: {}, recontactDueThisWeek: 0 })),
    listInsightClients(user)
      .then((cs) => geoDashboardSummary(cs.map((c) => c.id)))
      .catch(() => null)
  ]);

  let summary: DashboardSummary = ZERO_SUMMARY;
  if (dashboardInput) {
    try {
      summary = summarizeDashboard(dashboardInput);
    } catch {
      summary = ZERO_SUMMARY;
    }
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<SearchNoticesSkeleton />}>
        <SearchEngineNotices />
      </Suspense>
      <DashboardHome
        userName={user.name}
        role={user.role}
        summary={summary}
        riskItems={riskItems}
        clientMonitor={clientMonitor}
        confirmations={confirmations}
        leadPipeline={leadPipeline}
        geoSummary={geoSummary}
      />
    </div>
  );
}
