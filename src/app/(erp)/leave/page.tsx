import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { leaveStatusLabels, leaveTypeLabels } from "@/domain/leave";
import { Role } from "@/domain/types";
import { fetchLeaveOverviewForUser, type LeaveRequestListItem } from "@/server/repositories/leave";
import { getCurrentUser } from "@/server/session";

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
  {
    key: "type",
    header: "유형",
    render: (request) => leaveTypeLabels[request.type]
  },
  {
    key: "status",
    header: "상태",
    render: (request) => <StatusBadge request={request} />
  },
  {
    key: "reason",
    header: "사유",
    render: (request) => request.reason ?? "-"
  }
];

const approvalColumns: DataTableColumn<LeaveRequestListItem>[] = [
  {
    key: "requester",
    header: "신청자",
    render: (request) => request.requesterName
  },
  ...requestColumns
];

export default async function LeavePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const overview = await fetchLeaveOverviewForUser(user);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">연차/휴가</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">사내 연차 및 휴가 관리</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            담당자는 휴가 신청과 잔여 일수를 확인하고, 관리자와 최고관리자는 승인 대기 건을 함께 검토합니다.
          </p>
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

      <form className="grid gap-3 rounded-md border border-line bg-white p-4 md:grid-cols-5">
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">유형</span>
          <select name="type" className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink">
            {Object.entries(leaveTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">시작일</span>
          <input type="date" name="startDate" className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">종료일</span>
          <input type="date" name="endDate" className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">일수</span>
          <input type="number" step="0.5" min="0.5" name="daysRequested" className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">사유</span>
          <input name="reason" className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <div className="flex items-end md:col-span-5">
          <button type="button" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
            신청 저장 준비중
          </button>
        </div>
      </form>

      {user.role !== Role.MARKETER ? (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">승인 대기</h3>
          <DataTable columns={approvalColumns} rows={overview.approvalRequests} emptyMessage="승인 대기 중인 휴가 신청이 없습니다." />
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">내 신청 내역</h3>
        <DataTable columns={requestColumns} rows={overview.requests} emptyMessage="휴가 신청 내역이 없습니다." />
      </div>
    </section>
  );
}
