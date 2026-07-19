// 거래처 파이프라인 칸반 보드 — 단계(ClientStage)별 컬럼(Phase 3 가시성). 서버 컴포넌트.
// 리드 보드(LeadBoard)의 거래처 버전 — "지금 어느 단계에 몇 곳"을 한눈에.
import Link from "next/link";
import type { Route } from "next";
import { ACTIVE_CLIENT_STAGES, clientStageLabels, toClientStage } from "@/domain/sales/client-stages";

type Row = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  stage?: string;
  industryName: string | null;
  industryColor: string | null;
  assignedMarketerName: string | null;
  outstanding?: boolean;
};

const STAGE_ACCENT: Record<string, string> = {
  ONBOARDING: "border-t-sky-400",
  KEYWORD: "border-t-indigo-400",
  GEO: "border-t-violet-400",
  CONTENT: "border-t-amber-400",
  LIVE: "border-t-emerald-400"
};

export function ClientBoard({ rows }: { rows: Row[] }) {
  const active = rows.filter((r) => r.active);
  const byStage = new Map<string, Row[]>();
  for (const s of ACTIVE_CLIENT_STAGES) byStage.set(s, []);
  const parked: Row[] = []; // 중지·해지 등 활성 5단계 밖
  for (const r of active) {
    const s = toClientStage(r.stage);
    if (byStage.has(s)) byStage.get(s)!.push(r);
    else parked.push(r);
  }

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-[840px] gap-3">
          {ACTIVE_CLIENT_STAGES.map((stage) => {
            const items = byStage.get(stage) ?? [];
            return (
              <div key={stage} className="flex w-[200px] shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-ink">{clientStageLabels[stage]}</span>
                  <span className="rounded-full bg-surface px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line bg-surface/40 px-3 py-6 text-center text-[11px] text-slate-400">없음</p>
                  ) : (
                    items.map((r) => (
                      <Link
                        key={r.id}
                        href={`/clients/${r.id}` as Route}
                        className={`rounded-xl border border-line border-t-2 bg-card p-3 shadow-sm transition-colors hover:border-brand/40 ${STAGE_ACCENT[stage] ?? ""}`}
                      >
                        <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{r.code}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {r.industryName ? (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: (r.industryColor ?? "#e2e8f0") + "22", color: r.industryColor ?? "#475569" }}>
                              {r.industryName}
                            </span>
                          ) : null}
                          {r.outstanding ? <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">미수금</span> : null}
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">{r.assignedMarketerName ?? "미배정"}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {parked.length > 0 ? (
        <p className="mt-2 text-[11px] text-slate-400">중지·해지 {parked.length}곳은 목록 보기에서 확인하세요.</p>
      ) : null}
    </div>
  );
}
