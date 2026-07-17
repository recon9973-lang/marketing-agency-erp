// src/app/(erp)/portal-requests/[id]/page.tsx
// ERP 내부 — 포털 요청 상세 (상태 변경 + 답변 + 댓글)

import { notFound, redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import Link from "next/link";
import { ErpRequestActions } from "@/components/erp/ErpRequestActions";
import { CommentSection } from "@/components/portal/CommentSection";

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType?: string | null) {
  if (!mimeType) return "📎";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.startsWith("video/")) return "🎬";
  return "📎";
}

export default async function ErpRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "CLIENT") redirect("/portal/dashboard");

  const request = await db.clientRequest.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          assignedMarketerId: true,
          assignedMarketer: { select: { name: true } },
        },
      },
      author: { select: { name: true, email: true } },
      assignee: { select: { id: true, name: true } },
    },
  });

  if (!request) notFound();

  // 마케터 접근 제어: 자신이 담당한 거래처 요청만
  if (
    user.role === "MARKETER" &&
    request.client.assignedMarketerId !== user.id
  ) {
    notFound();
  }

  const [comments, attachments, marketers] = await Promise.all([
    db.clientComment.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true, role: true } } },
    }),
    db.clientAttachment.findMany({
      where: { requestId: request.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileSizeBytes: true,
        mimeType: true,
        createdAt: true,
        uploader: { select: { name: true } },
      },
    }),
    // 담당자 지정용 마케터 목록 (관리자/최고관리자만 필요)
    user.role !== "MARKETER"
      ? db.user.findMany({
          where: { role: { in: ["MARKETER", "ADMIN"] }, isActive: true },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* 뒤로 */}
      <Link
        href="/portal-requests"
        className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
      >
        ← 요청 인박스
      </Link>

      {/* 헤더 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  STATUS_STYLES[request.status]
                }`}
              >
                {STATUS_LABELS[request.status]}
              </span>
              <Link
                href={`/clients/${request.client.id}`}
                className="text-xs font-semibold text-sky-600 hover:text-sky-800"
              >
                {request.client.name} →
              </Link>
              <span className="text-xs text-slate-400">
                {CATEGORY_LABELS[request.category]}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">{request.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 flex-wrap">
              <span>
                {new Date(request.createdAt).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>
                작성: {request.author.name} ({request.author.email})
              </span>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {request.body}
        </div>
      </div>

      {/* 액션 패널 (상태 변경 + 답변 + 담당자) */}
      <ErpRequestActions
        requestId={request.id}
        currentStatus={request.status}
        currentAdminNote={request.adminNote ?? ""}
        currentAssigneeId={request.assignee?.id ?? null}
        marketers={marketers}
        canAssign={user.role !== "MARKETER"}
      />

      {/* 첨부파일 */}
      {attachments.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-700">
            첨부파일 ({attachments.length})
          </h2>
          <div className="grid gap-2">
            {attachments.map((att) => (
              <a
                key={att.id}
                href={att.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100
                  hover:border-sky-200 hover:bg-sky-50 transition-colors group"
              >
                <span className="text-xl">{fileIcon(att.mimeType)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 truncate group-hover:text-sky-700">
                    {att.fileName}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {att.fileSizeBytes ? formatBytes(att.fileSizeBytes) + " · " : ""}
                    {att.uploader.name} ·{" "}
                    {new Date(att.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <span className="text-xs text-slate-300 group-hover:text-sky-400 shrink-0">
                  다운로드 →
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 댓글 (포털 CommentSection 재사용 — 거래처·내부 양방향) */}
      <CommentSection
        requestId={request.id}
        currentUserId={user.id}
        currentUserName={user.name}
        comments={comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt.toISOString(),
          author: {
            id: c.author.id,
            name: c.author.name,
            role: c.author.role as string,
          },
        }))}
      />
    </div>
  );
}
