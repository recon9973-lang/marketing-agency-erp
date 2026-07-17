// src/app/portal/files/page.tsx
// 파일함 — 클라이언트 포털 (내 거래처에 업로드된 모든 첨부파일 목록)

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import Link from "next/link";

type FilterType = "ALL" | "IMAGE" | "PDF" | "DOC" | "OTHER";

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
  if (mimeType.startsWith("audio/")) return "🎵";
  return "📎";
}

function getFilterCategory(mimeType?: string | null): FilterType {
  if (!mimeType) return "OTHER";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === "application/pdf") return "PDF";
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint")
  )
    return "DOC";
  return "OTHER";
}

export default async function PortalFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id! },
    select: { clientId: true },
  });
  if (!user?.clientId) redirect("/portal/dashboard");

  const attachments = await db.clientAttachment.findMany({
    where: { clientId: user.clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      fileSizeBytes: true,
      mimeType: true,
      createdAt: true,
      requestId: true,
      reportId: true,
      uploader: { select: { name: true, role: true } },
    },
  });

  const typeFilter = (typeParam as FilterType) ?? "ALL";

  const filtered =
    typeFilter === "ALL"
      ? attachments
      : attachments.filter(
          (a) => getFilterCategory(a.mimeType) === typeFilter
        );

  const counts = {
    ALL: attachments.length,
    IMAGE: attachments.filter((a) => getFilterCategory(a.mimeType) === "IMAGE").length,
    PDF: attachments.filter((a) => getFilterCategory(a.mimeType) === "PDF").length,
    DOC: attachments.filter((a) => getFilterCategory(a.mimeType) === "DOC").length,
    OTHER: attachments.filter((a) => getFilterCategory(a.mimeType) === "OTHER").length,
  };

  const totalBytes = attachments.reduce(
    (sum, a) => sum + (a.fileSizeBytes ?? 0),
    0
  );

  const tabs: { label: string; value: FilterType }[] = [
    { label: "전체", value: "ALL" },
    { label: "이미지", value: "IMAGE" },
    { label: "PDF", value: "PDF" },
    { label: "문서", value: "DOC" },
    { label: "기타", value: "OTHER" },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">파일함</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            보고서·요청에 첨부된 모든 파일을 한 곳에서 확인합니다.
          </p>
        </div>
        {totalBytes > 0 && (
          <div className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full">
            총 {attachments.length}개 · {formatBytes(totalBytes)}
          </div>
        )}
      </div>

      {/* 탭 필터 */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((tab) => {
          const isActive = typeFilter === tab.value;
          const href =
            tab.value === "ALL"
              ? "/portal/files"
              : `/portal/files?type=${tab.value}`;
          const count = counts[tab.value];
          return (
            <Link
              key={tab.value}
              href={href as never}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5
                ${
                  isActive
                    ? "bg-sky-500 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-sky-300"
                }`}
            >
              {tab.label}
              <span
                className={`text-xs ${
                  isActive ? "text-sky-100" : "text-slate-400"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* 파일 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <p className="text-3xl mb-3">📂</p>
          <p className="text-slate-500 text-sm">
            {typeFilter === "ALL"
              ? "아직 업로드된 파일이 없습니다."
              : "해당 유형의 파일이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3 border-b border-slate-50 text-xs text-slate-400 font-medium">
            <span className="w-8" />
            <span>파일명</span>
            <span className="text-right">크기</span>
            <span className="text-right">날짜</span>
          </div>

          <div className="divide-y divide-slate-50">
            {filtered.map((att) => (
              <div
                key={att.id}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3.5
                  hover:bg-slate-50 transition-colors"
              >
                {/* 아이콘 */}
                <span className="text-xl w-8 text-center">
                  {fileIcon(att.mimeType)}
                </span>

                {/* 파일 정보 */}
                <div className="min-w-0">
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-slate-700 hover:text-sky-600 truncate block"
                  >
                    {att.fileName}
                  </a>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">
                      {att.uploader.role === "CLIENT" ? "내가 올림" : att.uploader.name}
                    </span>
                    {att.requestId && (
                      <Link
                        href={`/portal/requests/${att.requestId}`}
                        className="text-xs text-sky-400 hover:text-sky-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        요청 보기 →
                      </Link>
                    )}
                    {att.reportId && (
                      <Link
                        href={`/portal/reports/${att.reportId}`}
                        className="text-xs text-teal-400 hover:text-teal-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        보고서 보기 →
                      </Link>
                    )}
                  </div>
                </div>

                {/* 크기 */}
                <span className="text-xs text-slate-400 text-right whitespace-nowrap">
                  {att.fileSizeBytes ? formatBytes(att.fileSizeBytes) : "—"}
                </span>

                {/* 날짜 */}
                <span className="text-xs text-slate-400 text-right whitespace-nowrap">
                  {new Date(att.createdAt).toLocaleDateString("ko-KR", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
