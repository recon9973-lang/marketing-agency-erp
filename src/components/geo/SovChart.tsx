// 목표 경로: src/components/geo/SovChart.tsx
//
// 경쟁사 대비 SOV(Share of Voice) 시각화 — M1 computeGeoSov(SovResult)를 받아
// 자사 vs 경쟁사 출현 점유율 바 + 경쟁사별 언급 분해를 렌더한다.
// 상대지표(자사/(자사+경쟁사))만 표기 — 절대 인용%·통계 생성 없음(기획서 §7 모니터링 고지).
// GEO 모듈 액센트 emerald 준수, 신규 디자인 토큰 없음(테라코타/emerald/slate 기존 토큰만).
// 순수 뷰모델(buildSovView)을 분리해 오프라인 검증 가능 · 서버 컴포넌트(비인터랙티브).
import type { SovResult } from "@/server/geo-engine/sov";

export type SovViewCompetitor = { name: string; count: number; barPct: number };

export type SovView = {
  hasData: boolean; // 자사·경쟁사 통틀어 언급 관측이 1건이라도 있는가(sovPct !== null)
  sovPct: number | null; // 자사 점유율 % (자사/(자사+경쟁사)), 관측 0이면 null
  selfMentions: number;
  totalCompetitor: number;
  selfBarPct: number; // 최대 언급 수 대비 자사 막대 길이 %
  competitors: SovViewCompetitor[]; // 언급 수 내림차순(동률 시 이름 오름차순)
};

/** SovResult → 렌더 뷰모델(순수 함수). 정렬·상대 막대 길이 산출만 담당. */
export function buildSovView(sov: SovResult): SovView {
  const entries = Object.entries(sov.competitorMentions)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const maxCount = Math.max(sov.selfMentions, ...entries.map(([, n]) => n), 1);
  return {
    hasData: sov.sovPct !== null,
    sovPct: sov.sovPct,
    selfMentions: sov.selfMentions,
    totalCompetitor: sov.totalCompetitor,
    selfBarPct: Math.round((sov.selfMentions / maxCount) * 100),
    competitors: entries.map(([name, count]) => ({
      name,
      count,
      barPct: Math.round((count / maxCount) * 100)
    }))
  };
}

export function SovChart({ sov }: { sov: SovResult }) {
  const view = buildSovView(sov);

  if (!view.hasData) {
    return (
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-bold text-ink">경쟁사 대비 SOV</p>
          <p className="text-[10px] text-slate-400">AI 답변 출현 점유율 · 상대지표</p>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          자사·경쟁사 언급 관측이 아직 없습니다. GEO 답변 기록이 쌓이면 점유율이 표시됩니다.
        </p>
      </div>
    );
  }

  const selfPct = view.sovPct ?? 0;
  const compPct = 100 - selfPct;
  const behind = selfPct < 50; // 열세면 amber 강조(KPI 타일과 동일 기준)

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-ink">경쟁사 대비 SOV</p>
        <p className="text-[10px] text-slate-400">AI 답변 출현 점유율 · 자사 vs 경쟁사 언급 · 상대지표</p>
      </div>

      {/* 자사 점유율 헤드라인 + 점유 바 */}
      <div className="mt-3 flex items-center gap-3">
        <span className={`text-2xl font-bold leading-none ${behind ? "text-amber-600" : "text-emerald-600"}`}>
          {selfPct}%
        </span>
        <span className="text-[11px] text-slate-500">
          자사 점유율{behind ? " · 경쟁사 열세" : " · 우위"}
        </span>
      </div>
      <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full bg-emerald-600" style={{ width: `${selfPct}%` }} />
        <div className="h-full bg-slate-400" style={{ width: `${compPct}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
          자사 {view.selfMentions}회 · {selfPct}%
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
          경쟁사 {view.totalCompetitor}회 · {compPct}%
        </span>
      </div>

      {/* 자사·경쟁사 언급 수 분해(최대 언급 대비 상대 막대) */}
      <div className="mt-4 space-y-1.5">
        <p className="text-[10px] font-semibold text-slate-500">언급 분해 (관측 셀 기준)</p>
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-[11px] font-semibold text-ink" title="자사">자사</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full bg-emerald-600" style={{ width: `${Math.max(view.selfBarPct, view.selfMentions > 0 ? 4 : 0)}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] font-bold text-ink">{view.selfMentions}</span>
        </div>
        {view.competitors.length === 0 && (
          <p className="text-[10px] text-slate-400">관측 구간 내 경쟁사 언급 없음 — 자사만 출현.</p>
        )}
        {view.competitors.map((c) => (
          <div key={c.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[11px] text-slate-600" title={c.name}>{c.name}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div className="h-full bg-slate-400" style={{ width: `${Math.max(c.barPct, 4)}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-[11px] font-semibold text-slate-600">{c.count}</span>
          </div>
        ))}
      </div>

      <span className="sr-only">
        {`자사 SOV ${selfPct}% (자사 언급 ${view.selfMentions}, 경쟁사 언급 총 ${view.totalCompetitor}). ` +
          (view.competitors.length > 0
            ? `경쟁사별: ${view.competitors.map((c) => `${c.name} ${c.count}`).join(", ")}.`
            : "경쟁사 언급 없음.")}
      </span>
    </div>
  );
}
