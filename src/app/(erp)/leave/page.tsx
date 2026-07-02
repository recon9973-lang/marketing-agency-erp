import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DateInput, Input, NumberInput, Select } from "@/components/ui/fields";
import { leaveStatusLabels, leaveTypeLabels } from "@/domain/leave";
import { Role } from "@/domain/types";
import { fetchLeaveOverviewForUser, type LeaveRequestListItem } from "@/server/repositories/leave";
import { getCurrentUser } from "@/server/session";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

function formatDate(value: Date) {
  return dateFormatter.format(value);
}

function LeaveStatusBadge({ request }: { request: LeaveRequestListItem }) {
  const tone = request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "neutral";

  return <StatusBadge tone={tone}>{leaveStatusLabels[request.status]}</StatusBadge>;
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
    render: (request) => <LeaveStatusBadge request={request} />
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
      <PageHeader
        eyebrow="연차/휴가"
        title="사내 연차 및 휴가 관리"
        description="담당자는 휴가 신청과 잔여 일수를 확인하고, 관리자와 최고관리자는 승인 대기 건을 함께 검토합니다."
        actions={
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
        }
      />

      <form className="grid gap-3 rounded-md border border-line bg-white p-4 md:grid-cols-5">
        <FormField label="유형">
          <Select name="type">
            {Object.entries(leaveTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="시작일">
          <DateInput name="startDate" />
        </FormField>
        <FormField label="종료일">
          <DateInput name="endDate" />
        </FormField>
        <FormField label="일수">
          <NumberInput step="0.5" min="0.5" name="daysRequested" />
        </FormField>
        <FormField label="사유">
          <Input name="reason" />
        </FormField>
        <div className="flex items-end md:col-span-5">
          <Button type="button">신청 저장 준비중</Button>
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
