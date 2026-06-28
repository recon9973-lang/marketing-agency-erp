import { DashboardCard } from "@/components/dashboard/DashboardCard";
import type { DashboardSummary } from "@/domain/dashboard";

const currencyFormatter = new Intl.NumberFormat("ko-KR");

export function SuperAdminDashboard({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand">최고관리자 대시보드</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">전체 운영 현황</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          전체 업무, 정산, 지출, 휴가 승인 상태를 한눈에 확인합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DashboardCard label="전체 업무" value={summary.totalWorkCount} description="현재 관리 중인 전체 업무입니다." />
        <DashboardCard label="지연 업무" value={summary.delayedWorkCount} description="마감일이 지난 미완료 업무입니다." />
        <DashboardCard label="미수금" value={`${currencyFormatter.format(summary.unpaidAmount)}원`} description="입금 확인이 필요한 금액입니다." />
        <DashboardCard label="월 지출" value={`${currencyFormatter.format(summary.expenseTotal)}원`} description="등록된 회사 지출 합계입니다." />
        <DashboardCard label="휴가 승인 대기" value={summary.pendingLeaveCount} description="처리가 필요한 휴가 요청입니다." />
      </div>
    </section>
  );
}
