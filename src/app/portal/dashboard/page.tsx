// src/app/(portal)/dashboard/page.tsx
// 거래처 포털 홈 대시보드



import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import Link from "next/link";
import { ReportStatus } from "@prisma/client";

function statusLabel(s: ReportStatus) {
  return (
    { DRAFT: "작성 중", REVIEW_NEEDED: "검토 중", APPROVED: "승인됨", DELIVERED: "전달 완료" }[s] ??
    s
  );
}
function statusColor(s: ReportStatus) {
  return (
    {
      DRAFT: "bg-slate-100 text-slate-600",
      REVIEW_NEEDED: "bg-amber-50 text-amber-700",
      APPROVED: "bg-sky-50 text-sky-700",
      DELIVERED: "bg-green-50 text-green-700",
    }[s] ?? "bg-slate-100 text-slate-600"
  );
}

export default async function PortalDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id! },
    select: { clientId: true, name: true },
  });
  if (!user?.clientId) redirect("/portal/dashboard");

  const clientId = user.clientId;

  // 병렬 데이터 로드
  const [client, recentReports, openRequests, recentFiles] = await Promise.all([
    db.client.findUnique({
      where: { id: clientId },
      select: {
        name: true,
        contractStartDate: true,
        monthlyContractFee: true,
        assignedMarketer: { select: { name: true, email: true } },
      },
    }),
    db.report.findMany({
      where: { clientId },
      orderBy: { reportingMonth: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        reportingMonth: true,
        status: true,
        deliveredAt: true,
      },
    }),
    db.clientRequest.findMany({
      where: { clientId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        createdAt: true,
      },
    }),
    db.clientAttachment.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        fileName: true,
        fileSizeBytes: true,
        createdAt: true,
        uploader: { select: { name: true } },
      },
    }),
  ]);

  if (!client) redirect("/login");

  const latestReport = recentReports[0];

  return (
    <div className="space-y-6">
      {/* 인사 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          안녕하세요, {user.name}님 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {client.name} 포털에 오신 것을 환영합니다.
        </p>
      </div>

      {/* KPI 카드 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="최신 보고서"
          value={latestReport ? statusLabel(latestReport.status) : "—"}
          sub={
            latestReport
              ? new Date(latestReport.reportingMonth).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                })
              : "보고서 없음"
          }
          color={latestReport ? statusColor(latestReport.status) : "bg-slate-100 text-slate-500"}
        />
        <StatCard
          label="진행 중 요청"
          value={String(openRequests.length)}
          sub="열린 요청/문의"
          color="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="담당 마케터"
          value={client.assignedMarketer?.name ?? "—"}
          sub={client.assignedMarketer?.email ?? "미배정"}
          color="bg-sky-50 text-sky-700"
        />
        <StatCard
          label="계약 시작"
          value={
            client.contractStartDate
              ? new Date(client.contractStartDate).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "short",
                })
              : "—"
          }
          sub="계약일"
          color="bg-slate-50 text-slate-600"
        />
      </div>

      {/* 2열 레이아웃 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 최근 보고서 */}
        <SectionCard
          title="최근 보고서"
          linkHref="/portal/reports"
          linkLabel="전체 보기"
        >
          {recentReports.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              아직 보고서가 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentReports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/portal/reports/${r.id}`}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-4 px-4 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{r.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(r.reportingMonth).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(r.status)}`}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* 진행 중 요청 */}
        <SectionCard
          title="진행 중 요청/문의"
          linkHref="/portal/requests"
          linkLabel="전체 보기"
          action={{ href: "/portal/requests/new", label: "+ 새 요청" }}
        >
          {openRequests.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">
              진행 중인 요청이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {openRequests.map((req) => (
                <li key={req.id}>
                  <Link
                    href={`/portal/requests/${req.id}`}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 -mx-4 px-4 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {req.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {categoryLabel(req.category as string)} ·{" "}
                        {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        req.status === "IN_PROGRESS"
                          ? "bg-sky-50 text-sky-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {req.status === "IN_PROGRESS" ? "처리 중" : "접수"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* 최근 파일 */}
      {recentFiles.length > 0 && (
        <SectionCard title="최근 파일" linkHref="/portal/files" linkLabel="파일함 열기">
          <div className="grid grid-cols-2 gap-3">
            {recentFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
              >
                <span className="text-2xl">{fileIcon(f.fileName)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {f.fileName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {f.uploader.name} ·{" "}
                    {f.fileSizeBytes ? formatBytes(f.fileSizeBytes) : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${color}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-xs opacity-60 mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function SectionCard({
  title,
  linkHref,
  linkLabel,
  action,
  children,
}: {
  title: string;
  linkHref: string;
  linkLabel: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        <div className="flex items-center gap-3">
          {action && (
            <Link
              href={action.href as never}
              className="text-xs font-medium text-white bg-sky-500 hover:bg-sky-600 px-3 py-1 rounded-lg transition-colors"
            >
              {action.label}
            </Link>
          )}
          <Link
            href={linkHref as never}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {linkLabel} →
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── 유틸 ──────────────────────────────────────────

function categoryLabel(cat: string) {
  return (
    {
      CONTENT_REQUEST: "콘텐츠 요청",
      REPORT_INQUIRY: "보고서 문의",
      SCHEDULE_CHANGE: "일정 변경",
      ACCOUNT_ISSUE: "계정 문제",
      BILLING_INQUIRY: "청구 문의",
      OTHER: "기타",
    }[cat] ?? cat
  );
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "🖼️";
  if (["pdf"].includes(ext)) return "📄";
  if (["xlsx", "xls", "csv"].includes(ext)) return "📊";
  if (["docx", "doc"].includes(ext)) return "📝";
  if (["pptx", "ppt"].includes(ext)) return "📊";
  if (["zip", "rar"].includes(ext)) return "🗜️";
  return "📁";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
