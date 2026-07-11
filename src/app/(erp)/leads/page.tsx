// 목표 경로: src/app/(erp)/leads/page.tsx
//
// 영업 리드 파이프라인 — 활성 5단계 보드(기본) + 표 토글(?view=table).
// 종결(WON/LOST)·재접촉은 상단 요약칩 + 필터로 접근(패널 결정 #2·#4).
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, toneForStatus } from "@/components/ui/StatusBadge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { LeadBoard } from "@/components/leads/LeadBoard";
import { AddLeadForm } from "@/components/leads/AddLeadForm";
import { LeadStatusButtons } from "@/components/leads/LeadStatusButtons";
import { isLeadStatus, leadStatusLabels, ACTIVE_LEAD_STAGES } from "@/domain/sales/lead-stages";
import { listLeads, leadPipelineSummary, type LeadListItem } from "@/server/repositories/leads";
import { getCurrentUser } from "@/server/session";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string; status?: string; search?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const statusFilter = params.status && isLeadStatus(params.status) ? params.status : undefined;
  const view = params.view === "table" ? "table" : "board";

  const [leads, summary] = await Promise.all([
    listLeads(user, { status: statusFilter, search: params.search?.trim() || undefined }),
    leadPipelineSummary(user)
  ]);

  const activeLeads = statusFilter ? leads : leads.filter((l) => (ACTIVE_LEAD_STAGES as string[]).includes(l.status));

  const columns: DataTableColumn<LeadListItem>[] = [
    {
      key: "hospitalName",
      header: "병원명",
      render: (row) => (
        <Link href={`/leads/${row.id}`} className="font-medium text-ink hover:underline">
          {row.hospitalName}
        </Link>
      )
    },
    { key: "department", header: "진료과", render: (row) => row.department ?? "-" },
    { key: "region", header: "지역", render: (row) => row.region ?? "-" },
    {
      key: "status",
      header: "상태",
      render: (row) => <StatusBadge tone={toneForStatus(row.status)}>{leadStatusLabels[row.status as keyof typeof leadStatusLabels] ?? row.status}</StatusBadge>
    },
    { key: "grade", header: "등급", render: (row) => row.grade ?? "-" },
    { key: "assigneeName", header: "담당 AE", render: (row) => row.assigneeName ?? "미배정" },
    { key: "auditScore", header: "진단", render: (row) => (row.auditScore !== null ? `${row.auditScore}점` : "-") },
    {
      key: "nextActionAt",
      header: "다음 액션",
      render: (row) => (row.nextActionAt ? dateFmt.format(new Date(row.nextActionAt)) : "-")
    },
    { key: "actions", header: "전이", render: (row) => <LeadStatusButtons leadId={row.id} status={row.status} compact /> }
  ];

  const chip = (status: string, label: string) => {
    const count = summary.byStatus[status] ?? 0;
    const active = statusFilter === status;
    return (
      <Link
        key={status}
        href={active ? "/leads" : `/leads?status=${status}&view=table`}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          active ? "border-blue-300 bg-blue-50 text-blue-700" : "border-line bg-panel text-slate-600"
        }`}
      >
        {label} {count}
      </Link>
    );
  };

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="영업"
        title="영업 리드"
        description="리드 발굴 → 무료진단 → 브리핑 → 제안 → 계약까지의 파이프라인을 관리합니다."
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-line bg-panel p-0.5 text-xs">
            <Link
              href="/leads"
              className={`rounded-md px-2.5 py-1 ${view === "board" ? "bg-white font-semibold text-ink shadow-sm" : "text-slate-500"}`}
            >
              보드
            </Link>
            <Link
              href="/leads?view=table"
              className={`rounded-md px-2.5 py-1 ${view === "table" ? "bg-white font-semibold text-ink shadow-sm" : "text-slate-500"}`}
            >
              표
            </Link>
          </div>
        }
      />

      {/* 종결·재접촉 요약칩 + 이번 주 재접촉 */}
      <div className="flex flex-wrap items-center gap-2">
        {chip("WON", "계약성공")}
        {chip("LOST", "계약실패")}
        {chip("RECONTACT", "재접촉예약")}
        {summary.recontactDueThisWeek > 0 && (
          <span className="text-xs font-medium text-amber-600">
            이번 주 재접촉 예정 {summary.recontactDueThisWeek}건
          </span>
        )}
      </div>

      <AddLeadForm />

      {view === "board" && !statusFilter ? (
        <LeadBoard items={activeLeads} />
      ) : (
        <DataTable columns={columns} rows={statusFilter ? leads : activeLeads} emptyMessage="리드가 없습니다. 새 리드를 등록해보세요." />
      )}
    </section>
  );
}
