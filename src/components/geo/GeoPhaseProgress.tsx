// G4 — GEO 6단계(P0~P5) 진행바. VENOM GEO SOP(PDF)의 계약 후 운영 6단계.
// 데이터 기반: 각 단계 완료 여부를 실제 신호(관측·페이지·인용 등)로 판정. 서버 컴포넌트.
export type GeoPhase = { code: string; label: string; sub: string; done: boolean };

export function GeoPhaseProgress({ phases }: { phases: GeoPhase[] }) {
  // 현재 단계 = 첫 미완료(모두 완료면 마지막=운영 지속).
  const firstUndone = phases.findIndex((p) => !p.done);
  const currentIdx = firstUndone === -1 ? phases.length - 1 : firstUndone;

  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="text-xs font-bold text-ink">GEO 운영 단계</span>
        <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-strong">
          {phases[currentIdx].code} {phases[currentIdx].label}
        </span>
        <span className="text-[10px] text-slate-400">계약 후 P0→P5 · P3~P5 순환</span>
      </div>
      <ol className="flex flex-wrap items-stretch gap-2">
        {phases.map((p, i) => {
          const active = i === currentIdx;
          const done = p.done;
          return (
            <li key={p.code} className="flex min-w-[120px] flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  active
                    ? "bg-brand text-white ring-2 ring-brand/25"
                    : done
                      ? "bg-emerald-500 text-white"
                      : "bg-surface text-slate-400 ring-1 ring-line"
                }`}
              >
                {done && !active ? "✓" : p.code}
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${active ? "text-brand" : done ? "text-emerald-600" : "text-slate-500"}`}>
                  {p.label}
                </span>
                <span className="block truncate text-[10px] text-slate-400">{p.sub}</span>
              </span>
              {i < phases.length - 1 && (
                <span aria-hidden="true" className="ml-auto hidden text-slate-300 lg:inline">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
