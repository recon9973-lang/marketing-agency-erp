// src/app/(portal)/requests/page.tsx
// 요청/문의 목록



import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
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

export default async function PortalRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id! },
    select: { clientId: true },
  });
  if (!user?.clientId) redirect("/portal/dashboard");

  const requests = await db.clientRequest.findMany({
    where: {
      clientId: user.clientId,
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      assignee: { select: { name: true } },
      _count: { select: { comments: true, attachments: true } },
    },
  });

  const tabs = [
    { label: "전체", value: undefined },
    { label: "진행 중", value: "OPEN" },
    { label: "처리 중", value: "IN_PROGRESS" },
    { label: "완료", value: "RESOLVED" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">요청/문의</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            마케팅 관련 요청 및 문의 사항을 관리합니다.
          </p>
        </div>
        <Link
          href="/portal/requests/new"
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          + 새 요청
        </Link>
      </div>

      {/* 탭 필터 */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => {
          const isActive = statusFilter === tab.value;
          const href = tab.value
            ? `/portal/requests?status=${tab.value}`
            : "/portal/requests";
          return (
            <Link
              key={tab.label}
              href={href as never}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                ${
                  isActive
                    ? "bg-sky-500 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-sky-300"
                }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* 목록 */}
      {requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-3xl mb-3">📝</p>
          <p className="text-slate-500 text-sm mb-4">요청/문의가 없습니다.</p>
          <Link
            href="/portal/requests/new"
            className="inline-flex px-4 py-2 bg-sky-500 text-white text-sm rounded-xl hover:bg-sky-600"
          >
            첫 요청 남기기
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {requests.map((req) => (
            <Link
              key={req.id}
              href={`/portal/requests/${req.id}`}
              className="block bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:border-sky-100 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_STYLES[req.status]
                      }`}
                    >
                      {STATUS_LABELS[req.status]}
                    </span>
                    <span className="text-xs text-slate-400">
                      {CATEGORY_LABELS[req.category]}
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-slate-800 truncate">
                    {req.title}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span>
                      {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                    {req.assignee && <span>담당: {req.assignee.name}</span>}
                    {req._count.comments > 0 && (
                      <span>💬 {req._count.comments}</span>
                    )}
                    {req._count.attachments > 0 && (
                      <span>📎 {req._count.attachments}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
