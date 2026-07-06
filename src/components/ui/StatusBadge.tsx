// V2 §1 공통 UI — StatusBadge
// tone 기반 배지 + 도메인 상태 → tone 매핑 helper.
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface text-slate-600 border-line",
  info: "bg-[#eef0ff] text-[#533afd] border-[#d5d8ff]",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
};

export function StatusBadge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// 도메인 상태 코드 → tone. V2 CRUD에서 상태별 색을 한 곳에서 관리.
const STATUS_TONE: Record<string, BadgeTone> = {
  // work
  TODO: "neutral",
  IN_PROGRESS: "info",
  REVIEW_NEEDED: "warning",
  DONE: "success",
  // leave / report / expense
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  DRAFT: "neutral",
  SUBMITTED: "info",
  // billing
  UNPAID: "warning",
  PAID: "success",
  OVERDUE: "danger",
};

export function toneForStatus(status: string): BadgeTone {
  return STATUS_TONE[status] ?? "neutral";
}
