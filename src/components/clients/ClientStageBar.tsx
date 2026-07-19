"use client";

// 거래처 라이프사이클 단계 바(파이프라인 백본 UI) — 계약 이후 5~8단계 흐름을 한눈에.
// 활성 5단계를 스테퍼로 보여주고, 담당자·관리자는 허용된 전이만 버튼으로 이동.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, XCircle, ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { transitionClientStage } from "@/server/actions/clients";
import {
  ACTIVE_CLIENT_STAGES,
  CLIENT_STAGE_ORDER,
  CLIENT_STAGE_TRANSITIONS,
  clientStageDescriptions,
  clientStageLabels,
  toClientStage,
  type ClientStage
} from "@/domain/sales/client-stages";

const STAGE_STEP_LABEL: Record<string, string> = {
  ONBOARDING: "5",
  KEYWORD: "6",
  GEO: "7",
  CONTENT: "8",
  LIVE: "운영"
};

export function ClientStageBar({
  clientId,
  stage,
  canManage,
  suggested
}: {
  clientId: string;
  stage: string;
  canManage: boolean;
  suggested?: ClientStage | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const current = toClientStage(stage);
  const currentOrder = CLIENT_STAGE_ORDER[current]; // -1 for PAUSED/CHURNED
  const nexts = CLIENT_STAGE_TRANSITIONS[current] ?? [];
  const isInactive = current === "PAUSED" || current === "CHURNED";

  function move(to: ClientStage) {
    start(async () => {
      const res = await transitionClientStage({ clientId, toStage: to });
      if (res.ok) router.refresh();
    });
  }

  // 전이 버튼 분류 — 전진(다음 활성), 후진(정정), 중지·해지·재개.
  const forward = nexts.filter((s) => CLIENT_STAGE_ORDER[s] > currentOrder && CLIENT_STAGE_ORDER[s] >= 0);
  const backward = nexts.filter((s) => CLIENT_STAGE_ORDER[s] >= 0 && CLIENT_STAGE_ORDER[s] < currentOrder && currentOrder >= 0);
  const resume = isInactive ? nexts.filter((s) => CLIENT_STAGE_ORDER[s] >= 0) : [];

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-ink">업무 진행 단계</p>
        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${isInactive ? "border-slate-200 bg-slate-50 text-slate-500" : "border-brand/30 bg-brand/10 text-brand"}`}>
          현재: {clientStageLabels[current]}
        </span>
      </div>

      {/* 활성 5단계 스테퍼 */}
      <div className="flex items-center gap-1">
        {ACTIVE_CLIENT_STAGES.map((s, i) => {
          const order = CLIENT_STAGE_ORDER[s];
          const done = currentOrder >= 0 && order < currentOrder;
          const active = s === current;
          return (
            <div key={s} className="flex flex-1 items-center gap-1">
              <div className="flex flex-1 flex-col items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    active
                      ? "bg-brand text-white ring-2 ring-brand/30"
                      : done
                        ? "bg-emerald-500 text-white"
                        : "bg-surface text-slate-400 ring-1 ring-line"
                  }`}
                >
                  {STAGE_STEP_LABEL[s]}
                </div>
                <span className={`mt-1 text-center text-[11px] ${active ? "font-bold text-brand" : done ? "text-emerald-600" : "text-slate-400"}`}>
                  {clientStageLabels[s]}
                </span>
              </div>
              {i < ACTIVE_CLIENT_STAGES.length - 1 && (
                <div className={`mb-4 h-0.5 flex-1 ${done ? "bg-emerald-400" : "bg-line"}`} />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500">{clientStageDescriptions[current]}</p>

      {/* Phase 4 — 자동 전환 제안(데이터 조건 충족 시). 사람이 확인해 이동. */}
      {suggested && suggested !== current && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 text-brand" />
          <span className="text-xs text-slate-700">
            <b className="text-brand-strong">{clientStageLabels[suggested]}</b> 단계 조건이 충족됐습니다. 다음 단계로 이동할까요?
          </span>
          {canManage && (
            <button type="button" onClick={() => move(suggested)} disabled={pending}
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
              {clientStageLabels[suggested]}로 이동 <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {resume.map((s) => (
            <button key={s} type="button" onClick={() => move(s)} disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
              <RotateCcw className="h-3.5 w-3.5" /> {clientStageLabels[s]}(으)로 재개
            </button>
          ))}
          {forward.map((s) => (
            <button key={s} type="button" onClick={() => move(s)} disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
              다음: {clientStageLabels[s]} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ))}
          {backward.map((s) => (
            <button key={s} type="button" onClick={() => move(s)} disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-brand disabled:opacity-50"
              title="오입력 정정 — 이전 단계로">
              ← {clientStageLabels[s]}
            </button>
          ))}
          {!isInactive && nexts.includes("PAUSED") && (
            <button type="button" onClick={() => move("PAUSED")} disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-amber-600 disabled:opacity-50">
              <Pause className="h-3.5 w-3.5" /> 일시중지
            </button>
          )}
          {nexts.includes("CHURNED") && (
            <button type="button" onClick={() => move("CHURNED")} disabled={pending}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-danger disabled:opacity-50">
              <XCircle className="h-3.5 w-3.5" /> 해지
            </button>
          )}
        </div>
      )}
    </div>
  );
}
