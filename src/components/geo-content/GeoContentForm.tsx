// GEO Studio · M3 콘텐츠 빌더 화면 — useActionState + 네이티브 폼(안정적) → 분석 결과.
"use client";

import { useActionState } from "react";
import { analyzeContentAction, type ContentAnalysis } from "@/server/actions/geo-content";

const SAMPLE =
  "안녕하세요, 오늘은 아메리카노에 대해 알아보겠습니다. 아메리카노는 에스프레소에 물을 더한 커피입니다. 원두 종류에 따라 맛이 달라집니다.";

const SCORE_LABELS: [keyof NonNullable<ContentAnalysis["score"]>, string][] = [
  ["bluf", "BLUF"],
  ["faqCoverage", "FAQ"],
  ["citationPotential", "인용가능성"],
  ["eeat", "E-E-A-T"],
  ["structuredData", "구조화"]
];

const PRIORITY_TONE: Record<string, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600"
};

function Bar({ label, value }: { label: string; value: number }) {
  const tone = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="text-slate-400">{value}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-surface">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

export function GeoContentForm() {
  const [state, formAction, pending] = useActionState(analyzeContentAction, null);

  return (
    <div className="space-y-4">
      <form action={formAction} className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 text-sm font-bold text-ink">콘텐츠 입력</p>
        <label className="block text-xs font-medium text-slate-600">
          타깃 키워드
          <input
            name="keyword"
            defaultValue="아메리카노"
            className="mt-1 w-full max-w-xs rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-slate-600">
          원문 (SEO 콘텐츠)
          <textarea
            name="content"
            rows={7}
            defaultValue={SAMPLE}
            className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink focus:border-emerald-400 focus:outline-none"
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {pending ? "분석 중…" : "📝 GEO 분석"}
          </button>
          <span className="text-[11px] text-slate-400">BLUF·FAQ·E-E-A-T·인용가능성·구조화 (현재 규칙 기반)</span>
          {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
        </div>
      </form>

      {state?.score && (
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-line bg-card p-4 lg:col-span-1">
              <p className="text-[11px] text-slate-500">종합 GEO 점수</p>
              <p className={`text-4xl font-bold ${state.score.total >= 70 ? "text-emerald-600" : state.score.total >= 40 ? "text-amber-600" : "text-rose-600"}`}>
                {state.score.total}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">키워드: {state.keyword || "—"}</p>
            </div>
            <div className="rounded-2xl border border-line bg-card p-4 lg:col-span-2">
              <p className="mb-3 text-sm font-bold text-ink">항목별 점수</p>
              <div className="space-y-2.5">
                {SCORE_LABELS.map(([k, lbl]) => (
                  <Bar key={k} label={lbl} value={state.score![k] as number} />
                ))}
              </div>
            </div>
          </div>

          {/* 개선 제안 */}
          {state.score.suggestions.length > 0 && (
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="mb-2 text-sm font-bold text-ink">개선 제안</p>
              <ul className="space-y-1.5">
                {state.score.suggestions.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_TONE[s.priority] ?? PRIORITY_TONE.low}`}>{s.priority}</span>
                    {s.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* BLUF 재작성 */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="mb-2 text-sm font-bold text-ink">BLUF 재작성 (핵심 전진 배치)</p>
            <p className="rounded-xl border border-line bg-surface p-3 text-[13px] leading-relaxed text-slate-700">{state.rewrite}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {/* E-E-A-T */}
            {state.eeat && (
              <div className="rounded-2xl border border-line bg-card p-4">
                <p className="mb-3 text-sm font-bold text-ink">E-E-A-T 진단 · 총 {state.eeat.total}</p>
                <div className="space-y-2">
                  <Bar label="경험(Experience)" value={state.eeat.experience} />
                  <Bar label="전문성(Expertise)" value={state.eeat.expertise} />
                  <Bar label="권위(Authoritativeness)" value={state.eeat.authoritativeness} />
                  <Bar label="신뢰(Trustworthiness)" value={state.eeat.trustworthiness} />
                </div>
              </div>
            )}

            {/* FAQ */}
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="mb-2 text-sm font-bold text-ink">자동 생성 FAQ ({state.faqItems?.length ?? 0})</p>
              <ul className="space-y-2">
                {state.faqItems?.map((f, i) => (
                  <li key={i} className="text-xs">
                    <p className="font-semibold text-ink">Q. {f.question}</p>
                    <p className="text-slate-500">A. {f.answer}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* JSON-LD */}
          {state.jsonLd && (
            <details className="rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer text-sm font-bold text-ink">FAQPage JSON-LD (schema.org — 복사해 &lt;head&gt;에 삽입)</summary>
              <pre className="mt-3 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[11px] leading-relaxed text-slate-700">
                {state.jsonLd}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
