"use client";

// GEO 학습 버전 관리 — 제안(학습)·적용·다운그레이드(넘버/기간/부분). 관리자 조작.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, RotateCcw, ChevronDown } from "lucide-react";
import { proposeGeoModel, applyGeoModel, rollbackGeoModel, rollbackWeightKind } from "@/server/actions/geo-learning";

type Weight = { kind: string; label: string; avgLift: number; upRate: number; n: number; weight: number };
type Diff = { kind: string; label: string; before: number | null; after: number | null; delta: number };
export type VersionRow = {
  id: string;
  version: number;
  status: string;
  summary: string;
  weights: Weight[];
  diff: Diff[];
  basisCount: number;
  appliedAt: string | null;
  createdAt: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  PROPOSED: { label: "제안됨", cls: "border-sky-200 bg-sky-50 text-sky-700" },
  ACTIVE: { label: "적용 중", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  SUPERSEDED: { label: "대체됨", cls: "border-slate-200 bg-slate-50 text-slate-500" },
  ROLLED_BACK: { label: "롤백됨", cls: "border-rose-200 bg-rose-50 text-rose-600" }
};

export function GeoLearningPanel({ versions, canManage }: { versions: VersionRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [afterDate, setAfterDate] = useState("");
  const [openId, setOpenId] = useState<string | null>(versions.find((v) => v.status === "ACTIVE")?.id ?? versions[0]?.id ?? null);

  const active = versions.find((v) => v.status === "ACTIVE") ?? null;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      if (res.ok) {
        setMsg(ok);
        router.refresh();
      } else setMsg(`실패: ${res.error ?? "오류"}`);
    });

  return (
    <div className="space-y-4">
      {/* 학습 실행 */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex-1">
          <p className="text-sm font-bold text-ink">학습 실행</p>
          <p className="text-[11px] text-slate-500">쌓인 실험 장부(개입→인용률)를 학습해 유의미한 변화가 있으면 새 버전을 제안하고 관리자에게 공지합니다.</p>
        </div>
        {canManage && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => proposeGeoModel().then((r) => ({ ok: r.ok, error: r.ok ? undefined : "권한/오류" })).then((r) => r), "학습 완료 — 새 제안이 있으면 목록에 표시됩니다.")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" /> 지금 학습 실행
          </button>
        )}
      </div>

      {msg && <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate-600">{msg}</p>}

      {/* 기간 다운그레이드 */}
      {canManage && active && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-4 text-xs">
          <span className="font-semibold text-slate-600">기간 다운그레이드:</span>
          <input type="date" value={afterDate} onChange={(e) => setAfterDate(e.target.value)} className="rounded-lg border border-line bg-card px-2 py-1 text-xs text-ink" />
          <span className="text-slate-400">이후 버전을 롤백하고 그 이전 최신을 적용</span>
          <button
            type="button"
            disabled={pending || !afterDate}
            onClick={() => run(() => rollbackGeoModel({ afterDate: new Date(afterDate).toISOString() }).then((r) => ({ ok: r.ok, error: "오류" })), "기간 롤백 완료")}
            className="ml-auto rounded-lg border border-line px-3 py-1.5 font-semibold text-slate-600 hover:text-rose-600 disabled:opacity-50"
          >
            기간 롤백
          </button>
        </div>
      )}

      {/* 버전 목록 */}
      {versions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface/40 px-4 py-10 text-center text-sm text-slate-400">
          아직 학습 버전이 없습니다. 실험 장부에 개입·인용률 데이터가 쌓이면 <b>지금 학습 실행</b>으로 첫 버전을 제안하세요.
        </p>
      ) : (
        <ol className="space-y-3">
          {versions.map((v) => {
            const st = STATUS[v.status] ?? STATUS.SUPERSEDED;
            const open = openId === v.id;
            return (
              <li key={v.id} className="rounded-2xl border border-line bg-card">
                <button type="button" onClick={() => setOpenId(open ? null : v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="font-mono text-sm font-bold text-brand">#{v.version}</span>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  <span className="flex-1 truncate text-sm text-ink">{v.summary}</span>
                  <span className="hidden text-[11px] text-slate-400 sm:inline">표본 {v.basisCount}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                  <div className="border-t border-line px-4 py-3">
                    {/* 가중치 */}
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">전략 가중치(우선순위)</p>
                    <div className="mb-3 space-y-1">
                      {v.weights.filter((w) => w.weight > 0).map((w) => (
                        <div key={w.kind} className="flex items-center gap-2 text-xs">
                          <span className="w-20 shrink-0 text-slate-600">{w.label}</span>
                          <div className="h-2 flex-1 rounded-full bg-surface">
                            <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, w.weight)}%` }} />
                          </div>
                          <span className="w-24 shrink-0 text-right tabular-nums text-slate-500">{w.weight}% · +{w.avgLift}%p</span>
                          {canManage && v.status === "ACTIVE" && (
                            <button type="button" disabled={pending} title="이 항목만 이전 값으로 되돌리기(부분 롤백)"
                              onClick={() => run(() => rollbackWeightKind({ kind: w.kind }).then((r) => ({ ok: r.ok, error: "오류" })), `부분 롤백: ${w.label}`)}
                              className="text-[10px] text-slate-400 hover:text-rose-600 disabled:opacity-50">되돌리기</button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* diff */}
                    {v.diff?.length > 0 && (
                      <>
                        <p className="mb-1 text-[11px] font-semibold text-slate-500">직전 대비 변화</p>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {v.diff.filter((d) => Math.abs(d.delta) >= 0.1).slice(0, 8).map((d) => (
                            <span key={d.kind} className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${d.delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                              {d.label} {d.delta >= 0 ? "▲" : "▼"}{Math.abs(d.delta)}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {/* 액션 */}
                    {canManage && (
                      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                        {v.status === "PROPOSED" && (
                          <button type="button" disabled={pending}
                            onClick={() => run(() => applyGeoModel({ id: v.id }).then((r) => ({ ok: r.ok, error: "오류" })), `#${v.version} 적용됨`)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                            <Check className="h-3.5 w-3.5" /> 지금 적용
                          </button>
                        )}
                        {(v.status === "SUPERSEDED" || v.status === "ROLLED_BACK") && (
                          <button type="button" disabled={pending}
                            onClick={() => run(() => rollbackGeoModel({ toVersion: v.version }).then((r) => ({ ok: r.ok, error: "오류" })), `#${v.version}로 다운그레이드됨`)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-brand disabled:opacity-50">
                            <RotateCcw className="h-3.5 w-3.5" /> 이 버전으로 다운그레이드
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
