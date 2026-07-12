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
import { Role } from "@/domain/types";
import { db } from "@/server/db";
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

  const [leads, summary, marketers] = await Promise.all([
    listLeads(user, { status: statusFilter, search: params.search?.trim() || undefined }),
    leadPipelineSummary(user),
    db.user.findMany({ where: { role: Role.MARKETER, status: "ACTIVE" }, select: { id: true, name: true } }).catch(() => [])
  ]);

  // 영업 퍼널 전환율(§7) — 종결(성공+실패) 대비 성공 비율
  const won = summary.byStatus["WON"] ?? 0;
  const lost = summary.byStatus["LOST"] ?? 0;
  const conversionRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

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
        className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
          active
            ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
            : "border-line bg-card text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
        }`}
      >
        {label} {count}
      </Link>
    );
  };

  // KPI 타일 — 파이프라인 한눈 요약
  const activeCount = (ACTIVE_LEAD_STAGES as readonly string[]).reduce((n, s) => n + (summary.byStatus[s] ?? 0), 0);
  const kpis = [
    {
      label: "진행 중 리드",
      value: activeCount,
      tone: "emerald" as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M3 4h14l-5.2 6v4.6L8.2 16v-6L3 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "계약 성공",
      value: won,
      tone: "emerald" as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="m7 10.2 2 2 4-4.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      label: "전환율 (종결 대비)",
      value: conversionRate !== null ? `${conversionRate}%` : "-",
      tone: "emerald" as const,
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 16 16 4M6.5 6.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm7 10a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    },
    {
      label: "이번 주 재접촉",
      value: summary.recontactDueThisWeek,
      tone: summary.recontactDueThisWeek > 0 ? ("amber" as const) : ("emerald" as const),
      icon: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    }
  ];

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow="영업"
        title="영업 리드"
        description="리드 발굴 → 무료진단 → 브리핑 → 제안 → 계약까지의 파이프라인을 관리합니다."
        actions={
          <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1 text-xs">
            <Link
              href="/leads"
              className={`rounded-lg px-3 py-1.5 font-semibold ${view === "board" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-ink"}`}
            >
              보드
            </Link>
            <Link
              href="/leads?view=table"
              className={`rounded-lg px-3 py-1.5 font-semibold ${view === "table" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-ink"}`}
            >
              표
            </Link>
          </div>
        }
      />

      {/* KPI 타일 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  s.tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {s.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-xl font-bold leading-tight text-ink">{s.value}</span>
                <span className="block truncate text-[11px] text-slate-500">{s.label}</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 종결·재접촉 필터칩 */}
      <div className="flex flex-wrap items-center gap-2">
        {chip("WON", "계약성공")}
        {chip("LOST", "계약실패")}
        {chip("RECONTACT", "재접촉예약")}
      </div>

      <AddLeadForm marketers={marketers} />

      {view === "board" && !statusFilter ? (
        <LeadBoard items={activeLeads} />
      ) : (
        <DataTable columns={columns} rows={statusFilter ? leads : activeLeads} emptyMessage="리드가 없습니다. 새 리드를 등록해보세요." />
      )}
    </section>
  );
}
