// src/app/(erp)/portal-requests/page.tsx
// ERP 내부 — 포털 요청/문의 인박스 (마케터/관리자)

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  CONTENT_REQUEST: "콘텐츠 요청",
  REPORT_INQUIRY: "보고서 문의",
  SCHEDULE_CHANGE: "일정 변경",
  ACCOUNT_ISSUE: "계정 문제",
  BILLING_INQUIRY: "청구 문의",
  OTHER: "기타",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "접수",
  IN_PROGRESS: "처리 중",
  RESOLVED: "해결됨",
  CLOSED: "종료",
};

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700 border border-amber-200",
  IN_PROGRESS: "bg-sky-50 text-sky-700 border border-sky-200",
  RESOLVED: "bg-green-50 text-green-700 border border-green-200",
  CLOSED: "bg-slate-100 text-slate-500",
};

export default async function ErpPortalRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; mine?: string }>;
}) {
  const { status: statusFilter, mine } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/portal/dashboard");

  const isMarketer = user.role === "MARKETER";
  const mineOnly = mine === "1" || isMarketer;

  // 마케터: 자신이 담당한 거래처의 요청만
  // 관리자/최고관리자: 전체 요청 (mine=1 파라미터로 본인 담당만 필터 가능)
  const clientIdFilter = mineOnly
    ? await db.client
        .findMany({
          where: { assignedMarketerId: user.id },
          select: { id: true },
        })
        .then((cs) => cs.map((c) => c.id))
    : undefined;

  const requests = await db.clientRequest.findMany({
    where: {
      ...(clientIdFilter ? { clientId: { in: clientIdFilter } } : {}),
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      client: { select: { id: true, name: true } },
      author: { select: { name: true } },
      assignee: { select: { name: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });

  // 상태별 카운트
  const openCount = requests.filter((r) => r.status === "OPEN").length;
  const inProgressCount = requests.filter((r) => r.status === "IN_PROGRESS").length;

  const tabs = [
    { label: "전체", value: undefined },
    { label: "접수", value: "OPEN" },
    { label: "처리 중", value: "IN_PROGRESS" },
    { label: "해결됨", value: "RESOLVED" },
    { label: "종료", value: "CLOSED" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-800">포털 요청 인박스</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {isMarketer
              ? "담당 거래처의 요청/문의를 처리합니다."
              : "전체 거래처의 요청/문의를 관리합니다."}
          </p>
        </div>

        {/* 긴급 뱃지 */}
        {(openCount > 0 || inProgressCount > 0) && (
          <div className="flex gap-2">
            {openCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-700 font-medium">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                미처리 {openCount}건
              </span>
            )}
            {inProgressCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 border border-sky-200 rounded-full text-sm text-sky-700 font-medium">
                처리 중 {inProgressCount}건
              </span>
            )}
          </div>
        )}
      </div>

      {/* 관리자 전용: 내 담당만 필터 */}
      {!isMarketer && (
        <div className="flex gap-2">
          <Link
            href="/portal-requests"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${!mineOnly || statusFilter
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
          >
            전체 거래처
          </Link>
          <Link
            href="/portal-requests?mine=1"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${mineOnly && !isMarketer
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
          >
            내 담당만
          </Link>
        </div>
      )}

      {/* 상태 탭 */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => {
          const isActive = statusFilter === tab.value;
          const base = mineOnly && !isMarketer ? "?mine=1" : "";
          const href = tab.value
            ? `/portal-requests${base}${base ? "&" : "?"}status=${tab.value}`
            : `/portal-requests${base}`;

          return (
            <Link
              key={tab.label}
              href={href as never}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${isActive
                  ? "bg-sky-500 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-sky-300"
                }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* 요청 목록 */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-slate-500 text-sm">처리할 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map((req) => (
            <Link
              key={req.id}
              href={`/portal-requests/${req.id}`}
              className="block bg-white rounded-2xl border border-slate-100 p-5
                hover:shadow-md hover:border-sky-100 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_STYLES[req.status]
                      }`}
                    >
                      {STATUS_LABELS[req.status]}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {req.client.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {CATEGORY_LABELS[req.category]}
                    </span>
                  </div>

                  <h2 className="text-sm font-semibold text-slate-800 truncate">
                    {req.title}
                  </h2>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap">
                    <span>
                      {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                    <span>작성: {req.author.name}</span>
                    {req.assignee ? (
                      <span className="text-sky-500">담당: {req.assignee.name}</span>
                    ) : (
                      <span className="text-amber-500">담당자 미지정</span>
                    )}
                    {req._count.comments > 0 && (
                      <span>💬 {req._count.comments}</span>
                    )}
                    {req._count.attachments > 0 && (
                      <span>📎 {req._count.attachments}</span>
                    )}
                  </div>
                </div>

                <span className="text-slate-300 text-sm shrink-0">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
