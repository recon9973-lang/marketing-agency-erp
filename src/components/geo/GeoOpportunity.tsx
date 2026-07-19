// B7 기회 점수 3카드 + B10 전략 방향성. 순수 표시(점수·전략은 서버에서 규칙 기반 산출).
import type { OpportunityScore } from "@/server/geo-studio/opportunity";

const GRADE_TONE: Record<string, string> = {
  "매우 높음": "text-emerald-600",
  "높음": "text-emerald-600",
  "보통": "text-amber-600",
  "낮음": "text-slate-500"
};

export function GeoOpportunity({ score, strategies }: { score: OpportunityScore; strategies: string[] }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">B7·B10</span>
        <h3 className="text-sm font-bold text-ink">기회 점수 · 전략 방향성</h3>
        <span className="text-[10px] text-slate-400">규칙 기반 · 관측 데이터 파생</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface/60 p-3">
          <p className="text-[11px] text-slate-500">🏆 브랜드 언급률</p>
          <p className={`mt-1 text-xl font-extrabold ${GRADE_TONE[score.mentionGrade]}`}>{score.mentionGrade}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">AI가 우리를 언급하는 비율</p>
        </div>
        <div className="rounded-xl border border-line bg-surface/60 p-3">
          <p className="text-[11px] text-slate-500">🎯 자사 언급 가능성</p>
          <p className={`mt-1 text-xl font-extrabold ${GRADE_TONE[score.absorbGrade]}`}>{score.absorbGrade}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">콘텐츠·인용 준비도</p>
        </div>
        <div className="rounded-xl border border-line bg-surface/60 p-3">
          <p className="text-[11px] text-slate-500">📊 종합 기회 점수</p>
          <p className="mt-1 text-xl font-extrabold text-brand">{score.totalScore}점</p>
          <p className="mt-0.5 text-[10px] text-slate-400">언급률+인용+준비도 종합</p>
        </div>
      </div>
      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-semibold text-slate-500">최적화 전략 방향성</p>
        <ol className="space-y-1.5">
          {strategies.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs text-slate-700">
              <span className="font-mono text-[10px] font-bold text-brand">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
