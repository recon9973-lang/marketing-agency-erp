// 목표 경로: src/components/clients/ClientOnboardingProgress.tsx
//
// 거래처 온보딩 Phase 진행률 — M5 STANDARD_ONBOARDING_TASKS(phase 태깅)를 기준으로
// 거래처 WorkItem을 제목 매칭해 Phase별 완료율을 집계·표시한다.
// 스키마 변경 0 — ClientDetail이 이미 로드한 works({id,title,status,dueDate})만 소비.
// 판정 로직(buildOnboardingProgress)은 순수 함수로 분리 → 오프라인 검증 가능.
// ERP 토큰 준수(테라코타 brand 진행 바 + 완료 100% emerald), 신규 토큰 없음.
import {
  STANDARD_ONBOARDING_TASKS,
  onboardingPhaseLabels,
  type OnboardingPhase
} from "@/domain/sales/onboarding-tasks";

type WorkLike = { title: string; status: string };

export type OnboardingTaskProgress = { title: string; done: boolean; tracked: boolean };
export type OnboardingPhaseProgress = {
  phase: OnboardingPhase;
  label: string;
  total: number;
  completed: number;
  pct: number;
  tasks: OnboardingTaskProgress[];
};

const PHASE_ORDER: OnboardingPhase[] = ["PHASE1_SETUP", "PHASE2_CONTENT", "PHASE3_GEO", "LIFECYCLE"];

/**
 * 표준 온보딩 태스크 ↔ 거래처 WorkItem(제목 매칭) → Phase별 진행률(순수 함수).
 * 완료 판정: 같은 제목 WorkItem 중 하나라도 COMPLETED면 done. tracked: 매칭 WorkItem 존재 여부.
 */
export function buildOnboardingProgress(works: WorkLike[]): OnboardingPhaseProgress[] {
  const seen = new Set<string>();
  const completed = new Set<string>();
  for (const w of works) {
    seen.add(w.title);
    if (w.status === "COMPLETED") completed.add(w.title);
  }

  const byPhase = new Map<OnboardingPhase, OnboardingPhaseProgress>();
  for (const t of STANDARD_ONBOARDING_TASKS) {
    const phase = t.phase ?? "LIFECYCLE";
    const slot =
      byPhase.get(phase) ??
      { phase, label: onboardingPhaseLabels[phase], total: 0, completed: 0, pct: 0, tasks: [] };
    const done = completed.has(t.title);
    slot.total++;
    if (done) slot.completed++;
    slot.tasks.push({ title: t.title, done, tracked: seen.has(t.title) });
    byPhase.set(phase, slot);
  }

  return PHASE_ORDER.filter((p) => byPhase.has(p)).map((p) => {
    const s = byPhase.get(p)!;
    s.pct = s.total ? Math.round((s.completed / s.total) * 100) : 0;
    return s;
  });
}

function ProgressBar({ pct }: { pct: number }) {
  const full = pct >= 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
      <div
        className={full ? "h-full bg-emerald-600" : "h-full bg-brand"}
        style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

export function ClientOnboardingProgress({ works }: { works: WorkLike[] }) {
  const phases = buildOnboardingProgress(works);
  const total = phases.reduce((s, p) => s + p.total, 0);
  const done = phases.reduce((s, p) => s + p.completed, 0);
  const overallPct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 전체 진행률 */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-ink">온보딩 전체 진행률</p>
          <p className="text-xs font-semibold text-slate-500">
            {done}/{total} · {overallPct}%
          </p>
        </div>
        <div className="mt-2">
          <ProgressBar pct={overallPct} />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          표준 온보딩 태스크(매뉴얼 Phase 1/2/3·라이프사이클)를 거래처 업무와 제목 매칭해 산출합니다. 업무 미생성 항목은 진행 대기로 표시됩니다.
        </p>
      </div>

      {/* Phase별 진행률 */}
      <div className="space-y-3">
        {phases.map((p) => (
          <div key={p.phase} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{p.label}</p>
              <span
                className={`shrink-0 text-xs font-bold ${
                  p.pct >= 100 ? "text-emerald-600" : p.completed > 0 ? "text-brand-strong" : "text-slate-400"
                }`}
              >
                {p.completed}/{p.total} · {p.pct}%
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar pct={p.pct} />
            </div>
            <ul className="mt-3 space-y-1.5">
              {p.tasks.map((t) => (
                <li key={t.title} className="flex items-start gap-2 text-[12px]">
                  <span
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      t.done
                        ? "bg-emerald-600 text-white"
                        : t.tracked
                          ? "border border-slate-300 text-slate-400"
                          : "border border-dashed border-slate-300 text-slate-300"
                    }`}
                    aria-hidden="true"
                  >
                    {t.done ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={t.done ? "text-slate-500 line-through" : "text-ink"}>{t.title}</span>
                    {!t.tracked && <span className="ml-1 text-[10px] text-slate-400">· 업무 미생성</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <span className="sr-only">
        {`온보딩 전체 진행률 ${overallPct}% (${done}/${total} 완료). ` +
          phases.map((p) => `${p.label} ${p.pct}%`).join(", ")}
      </span>
    </div>
  );
}
