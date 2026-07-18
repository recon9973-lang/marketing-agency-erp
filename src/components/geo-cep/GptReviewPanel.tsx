// GEO CEP · GPT 리뷰 패널 — 리스닝마인드 GPT 리뷰(종합분석/페르소나/자사언급) 탭 UI.
// "use client"이지만 서버액션 호출 없음(전 데이터 props). 탭 전환은 순수 useState → 안정.
"use client";

import { useState } from "react";
import type { GptReview } from "@/server/geo-studio/cep/review";
import { TierBadge } from "@/components/geo-common/TierBadge";

type Tab = "overview" | "persona" | "brand";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "종합 분석" },
  { id: "persona", label: "페르소나" },
  { id: "brand", label: "자사 언급" }
];

export function GptReviewPanel({ review, seedLabel }: { review: GptReview; seedLabel: string }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-ink">GPT 리뷰 — “{seedLabel}”</p>
        <TierBadge tier="ai" note="목 GPT(4-AI 예정)" />
      </div>

      <div className="mb-3 inline-flex rounded-xl bg-surface p-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.id ? "bg-card text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-3">
          {[
            { h: "주요 검색어 분석", b: review.overview.keywordAnalysis },
            { h: "검색결과·자사 노출 분석", b: review.overview.serpAnalysis },
            { h: "카테고리 진입점(CEP) 분석", b: review.overview.cepAnalysis },
            { h: "마케팅 전략 제언", b: review.overview.strategy }
          ].map((s) => (
            <div key={s.h}>
              <p className="text-xs font-bold text-emerald-700">{s.h}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{s.b}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "persona" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {review.personas.map((p, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-3">
              <p className="text-sm font-bold text-ink">{p.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{p.description}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-slate-700">{p.analysis}</p>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">예상 질문</p>
              <ul className="mt-1 space-y-1">
                {p.questions.map((q, j) => (
                  <li key={j} className="text-[12px] text-slate-600">· {q}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "brand" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[11px] text-slate-500">자사 언급 진입점 비율</p>
              <p className="text-xl font-bold text-emerald-700">{review.brandMention.coveredRate}%</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <p className="text-[11px] text-slate-500">화이트스페이스 비율(선점 기회)</p>
              <p className="text-xl font-bold text-blue-600">{review.brandMention.whitespaceRate}%</p>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed text-slate-700">{review.brandMention.note}</p>
        </div>
      )}
    </div>
  );
}
