import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CreateReportForm } from "@/components/reports/CreateReportForm";
import { GenerateMonthlyReport } from "@/components/reports/GenerateMonthlyReport";
import { TemplateFiller } from "@/components/settings/TemplateFiller";
import { LeaveSection } from "@/components/leave/LeaveSection";
import { CreateWeeklyReportForm, type WorklogPick } from "@/components/weekly/CreateWeeklyReportForm";
import { WeeklyReportList, type WeeklyItem } from "@/components/weekly/WeeklyReportList";
import { ReportStatus } from "@/domain/types";
import { fetchReportsForUser, type ReportListItem } from "@/server/repositories/reports";
import { fetchWeeklyReportsForUser } from "@/server/repositories/weekly-reports";
import { listWorkReports } from "@/server/repositories/work-report";
import { listClientsForUser } from "@/server/repositories/clients";
import { listTemplatesForUse } from "@/server/repositories/document-templates";
import { getCurrentUser } from "@/server/session";

// 결재 서류 유형 — 페이지 내부 탭(월간·주간·연차·서식). 상신하면 결재라인으로 연결된다.
type DocTab = "monthly" | "weekly" | "leave" | "forms";
const DOC_TABS: { key: DocTab; label: string; desc: string }[] = [
  { key: "monthly", label: "월간 보고서", desc: "거래처 월간 성과 리포트" },
  { key: "weekly", label: "주간보고", desc: "주간 업무보고(다중 취합)" },
  { key: "leave", label: "연차·휴가", desc: "휴가·연차 결재" },
  { key: "forms", label: "서식 발급", desc: "근로계약·재직증명 등" }
];

/** 이번 주(월~일) 범위 YYYY-MM-DD. */
function thisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });

const reportStatusLabels: Record<ReportStatus, string> = {
  [ReportStatus.DRAFT]: "작성중",
  [ReportStatus.REVIEW_NEEDED]: "검토필요",
  [ReportStatus.APPROVED]: "승인",
  [ReportStatus.DELIVERED]: "전달완료"
};

function fileNameFromUrl(url: string | null) {
  if (!url) return "-";
  return url.split("/").pop() ?? url;
}

const columns: DataTableColumn<ReportListItem>[] = [
  {
    key: "title",
    header: "보고서",
    render: (report) => (
      <div>
        <p className="font-medium text-ink">{report.title}</p>
        <p className="mt-1 text-xs text-slate-500">{monthFormatter.format(report.reportingMonth)}</p>
      </div>
    )
  },
  {
    key: "client",
    header: "거래처",
    render: (report) => report.clientName
  },
  {
    key: "owner",
    header: "작성/검토",
    render: (report) => (
      <div>
        <p>{report.authorName}</p>
        <p className="mt-1 text-xs text-slate-500">{report.reviewerName ?? "검토자 미배정"}</p>
      </div>
    )
  },
  {
    key: "metrics",
    header: "성과 요약",
    render: (report) => <span className="line-clamp-2 text-slate-600">{report.metricsSummary}</span>
  },
  {
    key: "attachment",
    header: "첨부",
    render: (report) => fileNameFromUrl(report.attachmentUrl)
  },
  {
    key: "status",
    header: "상태",
    render: (report) => <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-700">{reportStatusLabels[report.status]}</span>
  },
  {
    key: "dates",
    header: "검토/전달",
    render: (report) => (
      <div className="text-xs text-slate-500">
        <p>검토 {report.reviewedAt ? dateFormatter.format(report.reviewedAt) : "-"}</p>
        <p className="mt-1">전달 {report.deliveredAt ? dateFormatter.format(report.deliveredAt) : "-"}</p>
      </div>
    )
  }
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { doc } = await searchParams;
  const activeDoc: DocTab = doc === "weekly" ? "weekly" : doc === "leave" ? "leave" : doc === "forms" ? "forms" : "monthly";

  // 주간보고 탭: 내 주간보고 + 이번 주 업무 보고(다중 취합용).
  let weeklyItems: WeeklyItem[] = [];
  let worklogPicks: WorklogPick[] = [];
  if (activeDoc === "weekly") {
    const [weeklyRows, workScope] = await Promise.all([
      fetchWeeklyReportsForUser(user).catch(() => []),
      listWorkReports(user).catch(() => ({ reports: [], clients: [], workItems: [] }))
    ]);
    weeklyItems = weeklyRows.map((w) => ({
      id: w.id,
      authorName: w.authorName,
      weekStart: new Date(w.weekStart).toISOString(),
      summary: w.summary,
      achievements: w.achievements,
      plans: w.plans,
      issues: w.issues,
      editable: w.editable
    }));
    const { start, end } = thisWeekRange();
    worklogPicks = workScope.reports
      .filter((r) => r.authorId === user.id && r.workDate >= start && r.workDate <= end)
      .map((r) => ({ id: r.id, workDate: r.workDate, category: r.category, title: r.title, link: r.link }));
  }

  const [reports, clientRows, usableTemplates] = await Promise.all([
    fetchReportsForUser(user),
    listClientsForUser(user),
    listTemplatesForUse(["HR", "GENERAL"], user.role).catch(() => [])
  ]);
  const reviewNeeded = reports.filter((report) => report.status === ReportStatus.REVIEW_NEEDED).length;
  const delivered = reports.filter((report) => report.status === ReportStatus.DELIVERED).length;
  const clientOptions = clientRows.map((c) => ({ id: c.id, name: c.name }));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <DashboardHeader
          eyebrow="결재"
          title="결재"
          description="필요한 결재 서류(월간 보고서·주간보고·연차/휴가·서식)를 골라 작성합니다. 상신하면 담당자→관리자→최고관리자 순으로 결재됩니다."
        />
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">전체</p>
            <p className="mt-1 font-semibold text-ink">{reports.length}</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">검토</p>
            <p className="mt-1 font-semibold text-warning">{reviewNeeded}</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">전달</p>
            <p className="mt-1 font-semibold text-brand">{delivered}</p>
          </div>
        </div>
      </div>

      {/* 결재 서류 탭 (월간·연차·서식) + 주간보고(별도 라우트) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-1">
        {DOC_TABS.map((t) => {
          const on = t.key === activeDoc;
          return (
            <Link
              key={t.key}
              href={`/reports?doc=${t.key}` as Route}
              aria-current={on ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                on ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-surface"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* 월간 보고서 */}
      {activeDoc === "monthly" && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink">월간 보고서 · 거래처 월간 성과를 규칙기반으로 조립합니다. (GEO 주간 리포트는 GEO → 계획 탭에 있습니다.)</p>
          <GenerateMonthlyReport clients={clientOptions} />
          <CreateReportForm clients={clientOptions} />
          <DataTable columns={columns} rows={reports} emptyMessage="조회 가능한 보고서가 없습니다." />
        </div>
      )}

      {/* 주간보고 */}
      {activeDoc === "weekly" && (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-ink">주간 업무보고 · 이번 주 업무 보고를 골라 취합할 수 있습니다. 제출하면 담당자 → 관리자 → 최고관리자 순으로 결재됩니다.</p>
          <CreateWeeklyReportForm worklog={worklogPicks} />
          <WeeklyReportList items={weeklyItems} />
        </div>
      )}

      {/* 연차·휴가 */}
      {activeDoc === "leave" && <LeaveSection user={user} />}

      {/* 인사·일반 서식 발급 */}
      {activeDoc === "forms" && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">서식 발급</h3>
          <p className="text-sm text-slate-500">근로계약서·재직증명서 등 서식을 골라 항목을 채우고 인쇄/PDF로 발급합니다.</p>
          <TemplateFiller templates={usableTemplates} />
        </div>
      )}
    </section>
  );
}
