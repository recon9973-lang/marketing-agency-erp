// 목표 경로: src/components/geo/GeoWorkflowSteps.tsx
//
// GEO 워크플로우 스테퍼 — 담당자가 지금 어느 단계 업무를 보고 있는지 한눈에.
// 자동화되는 단계에는 AUTO 배지. 서버 컴포넌트(순수 마크업).
const STEPS: { label: string; sub: string; auto?: boolean }[] = [
  { label: "질문 설계", sub: "SOP 20문 자동 생성", auto: true },
  { label: "병원 승인", sub: "후보 일괄 승인" },
  { label: "자동 관측", sub: "매주 월요일 · 4개 엔진", auto: true },
  { label: "답변 페이지", sub: "AI 초안 + FAQ 스키마", auto: true },
  { label: "리포트·증빙", sub: "월간 리포트 자동 집계", auto: true }
];

export function GeoWorkflowSteps() {
  return (
    <ol className="flex flex-wrap items-stretch gap-2 rounded-2xl border border-line bg-card p-3">
      {STEPS.map((s, i) => (
        <li key={s.label} className="flex min-w-[128px] flex-1 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-xs font-semibold text-ink">
              {s.label}
              {s.auto && (
                <span className="rounded bg-emerald-600 px-1 py-px text-[8.5px] font-bold uppercase leading-none text-white">
                  auto
                </span>
              )}
            </span>
            <span className="block truncate text-[10px] text-slate-400">{s.sub}</span>
          </span>
          {i < STEPS.length - 1 && (
            <span aria-hidden="true" className="ml-auto hidden text-slate-300 lg:inline">
              ›
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
