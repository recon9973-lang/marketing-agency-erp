"use client";

/**
 * 마케팅 상담 진단 패널 — 거래처 현황 종합 + 대응 방향.
 * 상담 자리에서 바로 읽는 요약: 종합 단계 → 영역별 신호등 → 우선순위 대응 → 데이터 공백.
 */
import { useState } from "react";
import { Stethoscope, Copy, Check, AlertTriangle, ArrowUpRight } from "lucide-react";
import type { ConsultingReview } from "@/server/market/consulting-review";

type Signal = "good" | "watch" | "risk" | "nodata";

const SIGNAL: Record<Signal, { dot: string; ring: string; text: string; label: string }> = {
  good: { dot: "bg-emerald-500", ring: "border-emerald-200 dark:border-emerald-900/50", text: "text-emerald-600 dark:text-emerald-400", label: "양호" },
  watch: { dot: "bg-amber-500", ring: "border-amber-200 dark:border-amber-900/50", text: "text-amber-600 dark:text-amber-400", label: "주의" },
  risk: { dot: "bg-rose-500", ring: "border-rose-200 dark:border-rose-900/50", text: "text-rose-600 dark:text-rose-400", label: "위험" },
  nodata: { dot: "bg-slate-300 dark:bg-slate-600", ring: "border-line", text: "text-slate-400", label: "미수집" }
};

function scoreTone(n: number): string {
  if (n >= 75) return "text-emerald-600 dark:text-emerald-400";
  if (n >= 50) return "text-amber-600 dark:text-amber-400";
  if (n > 0) return "text-rose-600 dark:text-rose-400";
  return "text-slate-400";
}

export function ConsultingReviewPanel({
  review,
  markdown,
  region,
  departments,
  title = "마케팅 상담 진단",
  subtitle = "현황 종합과 대응 방향"
}: {
  review: ConsultingReview;
  markdown: string;
  region: string;
  departments: string[];
  title?: string;
  subtitle?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 차단 환경 — 무시(수동 선택 가능)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">{title}</h3>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">{review.stage}</span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              {region || "지역 미상"}{departments.length ? ` · ${departments.slice(0, 3).join("·")}` : ""} · {subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={copyBrief}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition hover:bg-surface/60 dark:text-slate-300"
        >
          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> 복사됨</> : <><Copy className="h-3.5 w-3.5" /> 상담 브리프 복사</>}
        </button>
      </div>

      {/* 종합 라인 */}
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface/50 px-4 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-3xl font-black tabular-nums ${scoreTone(review.overallScore)}`}>{review.overallScore}</span>
          <span className="text-xs text-slate-400">/100</span>
        </div>
        <p className="flex-1 min-w-[240px] text-[13px] leading-relaxed text-ink">{review.headline}</p>
      </div>
      <p className="mt-2 text-[12px] text-slate-500">{review.stageNote}</p>

      {/* 영역별 신호등 */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {review.areas.map((a) => {
          const s = SIGNAL[a.status as Signal];
          return (
            <div key={a.key} className={`rounded-xl border ${s.ring} bg-card p-3`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} /> {a.label}
                </span>
                <span className={`text-[10.5px] font-semibold ${s.text}`}>{s.label}</span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-slate-600 dark:text-slate-300">{a.signal}</p>
              {a.metric && <p className="mt-1 text-[11px] font-semibold tabular-nums text-slate-400">{a.metric}</p>}
            </div>
          );
        })}
      </div>

      {/* 대응 방향 */}
      {review.actions.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-ink">
            <ArrowUpRight className="h-4 w-4 text-brand" /> 대응 방향 (우선순위)
          </p>
          <ol className="space-y-2">
            {review.actions.map((a, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold text-white ${a.priority === 1 ? "bg-rose-500" : "bg-amber-500"}`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-bold text-ink">{a.title}</span>
                  <span className="text-[11px] text-slate-400">{a.area}{a.priority === 1 ? " · 시급" : ""}</span>
                </div>
                <p className="mt-1.5 text-[11.5px] text-slate-500"><b className="font-semibold text-slate-600 dark:text-slate-300">이유</b> {a.why}</p>
                <p className="mt-0.5 text-[11.5px] text-slate-500"><b className="font-semibold text-slate-600 dark:text-slate-300">실행</b> {a.how}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 데이터 공백(정직) */}
      {review.dataGaps.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[11.5px] text-amber-700 dark:text-amber-300">
            <b>데이터 공백:</b> {review.dataGaps.join(" · ")} — 실측 신호가 없어 진단에서 제외. 연결 시 진단 정밀도가 올라갑니다.
          </p>
        </div>
      )}
    </div>
  );
}
