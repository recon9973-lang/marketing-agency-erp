import { AlertTriangle, CalendarClock, ClipboardList, CreditCard, Wallet } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { WorkOverview } from "@/components/dashboard/WorkOverview";
import type { DashboardSummary } from "@/domain/dashboard";

const currencyFormatter = new Intl.NumberFormat("ko-KR");

export function SuperAdminDashboard({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="space-y-6">
      <DashboardHeader
        eyebrow="최고관리자 대시보드"
        title="전체 운영 현황"
        description="전체 업무, 정산, 지출, 휴가 승인 상태를 한눈에 확인합니다."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard label="전체 업무" value={summary.totalWorkCount} tone="brand" icon={ClipboardList} description="현재 관리 중인 전체 업무입니다." />
        <DashboardCard label="지연 업무" value={summary.delayedWorkCount} tone="rose" icon={AlertTriangle} description="마감일이 지난 미완료 업무입니다." />
        <DashboardCard label="미수금" value={`${currencyFormatter.format(summary.unpaidAmount)}원`} tone="amber" icon={Wallet} description="입금 확인이 필요한 금액입니다." />
        <DashboardCard label="월 지출" value={`${currencyFormatter.format(summary.expenseTotal)}원`} tone="slate" icon={CreditCard} description="등록된 회사 지출 합계입니다." />
        <DashboardCard label="휴가 승인 대기" value={summary.pendingLeaveCount} tone="amber" icon={CalendarClock} description="처리가 필요한 휴가 요청입니다." />
      </div>

      <WorkOverview summary={summary} />
    </section>
  );
}
