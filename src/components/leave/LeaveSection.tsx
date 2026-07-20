// 연차/휴가 섹션 — 결재 페이지 내부 탭과 (구)/leave 라우트에서 공통 사용하는 서버 컴포넌트.
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { LeavePanel } from "@/components/leave/LeavePanel";
import { leaveStatusLabels, leaveTypeLabels } from "@/domain/leave";
import { Role } from "@/domain/types";
import { fetchLeaveOverviewForUser, type LeaveRequestListItem } from "@/server/repositories/leave";
import type { CurrentUser } from "@/server/session";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function StatusBadge({ request }: { request: LeaveRequestListItem }) {
  const tone =
    request.status === "APPROVED"
      ? "border-brand/30 bg-brand/10 text-brand"
      : request.status === "REJECTED"
        ? "border-danger/30 bg-danger/10 text-danger"
        : "border-line bg-surface text-slate-700";

  return <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${tone}`}>{leaveStatusLabels[request.status]}</span>;
}

const requestColumns: DataTableColumn<LeaveRequestListItem>[] = [
  {
    key: "period",
    header: "기간",
    render: (request) => (
      <div>
        <p className="font-medium text-ink">
          {formatDate(request.startDate)} - {formatDate(request.endDate)}
        </p>
        <p className="mt-1 text-xs text-slate-500">{request.daysRequested}일</p>
      </div>
    )
  },
  { key: "type", header: "유형", render: (request) => leaveTypeLabels[request.type] },
  { key: "status", header: "상태", render: (request) => <StatusBadge request={request} /> },
  { key: "reason", header: "사유", render: (request) => request.reason ?? "-" }
];

export async function LeaveSection({ user }: { user: CurrentUser }) {
  const overview = await fetchLeaveOverviewForUser(user);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">연차·휴가</p>
          <p className="mt-0.5 text-xs text-slate-500">담당자는 휴가를 신청·확인하고, 관리자·최고관리자는 승인 대기 건을 검토합니다. 상신은 결재 절차를 따릅니다.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">부여</p>
            <p className="mt-1 font-semibold text-ink">{overview.allowanceDays}일</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">잔여</p>
            <p className="mt-1 font-semibold text-brand">{overview.remainingDays}일</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">승인대기</p>
            <p className="mt-1 font-semibold text-warning">{overview.approvalRequests.length}</p>
          </div>
        </div>
      </div>

      <LeavePanel
        canApprove={user.role !== Role.MARKETER}
        pending={overview.approvalRequests.map((request) => ({
          id: request.id,
          requesterName: request.requesterName,
          type: leaveTypeLabels[request.type],
          startDate: formatDate(request.startDate),
          endDate: formatDate(request.endDate),
          daysRequested: request.daysRequested
        }))}
      />

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">내 신청 내역</h3>
        <DataTable columns={requestColumns} rows={overview.requests} emptyMessage="휴가 신청 내역이 없습니다." />
      </div>
    </section>
  );
}
