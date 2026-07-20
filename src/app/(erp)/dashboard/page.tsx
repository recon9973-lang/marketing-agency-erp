import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { SearchEngineNotices, SearchNoticesSkeleton } from "@/components/dashboard/SearchEngineNotices";
import { InternalNoticesWidget } from "@/components/dashboard/InternalNoticesWidget";
import { MemoWidget } from "@/components/dashboard/MemoWidget";
import { FavoritesWidget } from "@/components/dashboard/FavoritesWidget";
import { MiniCalendarWidget } from "@/components/dashboard/MiniCalendarWidget";
import { Role } from "@/domain/types";
import { SafeBoundary } from "@/components/util/SafeBoundary";
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

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export default async function DashboardPage() {
  // 인증 확인은 쿠키 기반이라 빠르다 → 여기서만 대기.
  // 무거운 DB 조회는 아래 <Suspense> 안(DashboardData)에서 스트리밍한다.
  // 덕분에 껍데기(스켈레톤)가 즉시 뜨고, 데이터는 준비되는 대로 채워진다.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;

  return (
    <div className="space-y-6">
      {/* 공지사항(내부 작성) · 검색엔진 공지 — 반폭 2열 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SafeBoundary fallback={null}>
          <Suspense fallback={<SearchNoticesSkeleton />}>
            <InternalNoticesWidget canManage={isAdmin} />
          </Suspense>
        </SafeBoundary>
        <SafeBoundary fallback={null}>
          <Suspense fallback={<SearchNoticesSkeleton />}>
            <SearchEngineNotices />
          </Suspense>
        </SafeBoundary>
      </div>

      {/* 메모장 · 즐겨찾기 · 내부 캘린더 — 계정별 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SafeBoundary fallback={null}>
          <Suspense fallback={<div className="h-52 animate-pulse rounded-2xl bg-surface" />}>
            <MemoWidget userId={user.id} />
          </Suspense>
        </SafeBoundary>
        <SafeBoundary fallback={null}>
          <Suspense fallback={<div className="h-52 animate-pulse rounded-2xl bg-surface" />}>
            <FavoritesWidget user={user} />
          </Suspense>
        </SafeBoundary>
        <SafeBoundary fallback={null}>
          <Suspense fallback={<div className="h-52 animate-pulse rounded-2xl bg-surface" />}>
            <MiniCalendarWidget user={user} />
          </Suspense>
        </SafeBoundary>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData user={user} />
      </Suspense>
    </div>
  );
}

// 대시보드 데이터 — 무거운 조회를 담당. Suspense 경계 안에서 스트리밍된다.
async function DashboardData({ user }: { user: CurrentUser }) {
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
  );
}

// 데이터 도착 전 즉시 뜨는 골격 — KPI 카드 줄 + 하단 패널 형태만 잡아준다.
function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-line bg-slate-100/70" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-slate-100/70 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-2xl border border-line bg-slate-100/70" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl border border-line bg-slate-100/70" />
        <div className="h-48 animate-pulse rounded-2xl border border-line bg-slate-100/70" />
      </div>
    </div>
  );
}
