"use client";

// 인사관리평가 — 직원 주기별 다면 평가(업무성과·협업·성실성·전문성·태도) 작성·목록.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, Star } from "lucide-react";
import { saveHrEvaluation, deleteHrEvaluation } from "@/server/actions/hr-evaluation";
import type { HrEvaluationRow } from "@/server/repositories/hr-evaluation";

const CRITERIA = [
  { key: "performance", label: "업무성과" },
  { key: "collaboration", label: "협업" },
  { key: "diligence", label: "성실성" },
  { key: "expertise", label: "전문성" },
  { key: "attitude", label: "태도" }
] as const;

type CriterionKey = (typeof CRITERIA)[number]["key"];
type Scores = Record<CriterionKey, number>;
const DEFAULT_SCORES: Scores = { performance: 3, collaboration: 3, diligence: 3, expertise: 3, attitude: 3 };

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n}점`} className="p-0.5">
          <Star className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        </button>
      ))}
    </span>
  );
}

export function HrEvaluationPanel({
  staff,
  evaluations
}: {
  staff: { id: string; name: string; role: string }[];
  evaluations: HrEvaluationRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [evaluateeId, setEvaluateeId] = useState(staff[0]?.id ?? "");
  const [period, setPeriod] = useState("");
  const [scores, setScores] = useState<Scores>(DEFAULT_SCORES);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPeriod("");
    setScores(DEFAULT_SCORES);
    setStrengths("");
    setImprovements("");
    setComment("");
  }

  function submit() {
    setError(null);
    if (!evaluateeId || !period.trim()) {
      setError("대상 직원과 평가 주기를 입력하세요.");
      return;
    }
    start(async () => {
      const res = await saveHrEvaluation({ evaluateeId, period, ...scores, strengths, improvements, comment });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("이 평가를 삭제할까요?")) return;
    start(async () => {
      await deleteHrEvaluation({ id });
      router.refresh();
    });
  }

  const avgNow = Math.round((CRITERIA.reduce((s, c) => s + scores[c.key], 0) / CRITERIA.length) * 10) / 10;

  return (
    <div className="space-y-4">
      {/* 새 평가 */}
      <div className="rounded-2xl border border-line bg-card p-5">
        <p className="text-sm font-bold text-ink">새 평가 작성</p>
        <p className="mt-0.5 text-xs text-slate-500">직원을 선택하고 주기(예: 2026-Q3, 2026-07)를 입력한 뒤 항목별 점수를 매깁니다.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            대상 직원
            <select value={evaluateeId} onChange={(e) => setEvaluateeId(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand">
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            평가 주기
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="예: 2026-Q3" maxLength={40} className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
          </label>
        </div>

        <div className="mt-3 space-y-1.5">
          {CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center justify-between rounded-lg border border-line bg-surface/40 px-3 py-1.5">
              <span className="text-sm text-slate-600">{c.label}</span>
              <span className="flex items-center gap-2">
                <StarRow value={scores[c.key]} onChange={(v) => setScores((s) => ({ ...s, [c.key]: v }))} />
                <span className="w-6 text-right text-sm font-semibold tabular-nums text-ink">{scores[c.key]}</span>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 pt-1 text-sm">
            <span className="font-semibold text-slate-600">평균</span>
            <span className="font-bold text-brand">{avgNow} / 5</span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} placeholder="강점" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
          <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} rows={2} placeholder="개선점" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="종합 코멘트" className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />

        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={submit} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
            <Save className="h-4 w-4" /> 평가 저장
          </button>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>
      </div>

      {/* 평가 목록 */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">평가 이력 <span className="text-slate-400">({evaluations.length})</span></p>
        {evaluations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center text-sm text-slate-500">
            아직 등록된 평가가 없습니다. 위에서 첫 평가를 작성하세요.
          </p>
        ) : (
          evaluations.map((e) => (
            <div key={e.id} className="rounded-2xl border border-line bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{e.evaluateeName}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{e.period}</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600">평균 {e.average}</span>
                </div>
                <button type="button" onClick={() => remove(e.id)} disabled={pending} className="text-slate-300 hover:text-rose-500" aria-label="삭제">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {CRITERIA.map((c) => (
                  <span key={c.key}>{c.label} <b className="text-ink">{e[c.key]}</b></span>
                ))}
              </div>
              {(e.strengths || e.improvements || e.comment) && (
                <div className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-slate-600">
                  {e.strengths ? <p><b className="text-slate-500">강점</b> · {e.strengths}</p> : null}
                  {e.improvements ? <p><b className="text-slate-500">개선</b> · {e.improvements}</p> : null}
                  {e.comment ? <p><b className="text-slate-500">코멘트</b> · {e.comment}</p> : null}
                </div>
              )}
              {e.evaluatorName ? <p className="mt-1.5 text-right text-[10px] text-slate-400">평가자 {e.evaluatorName}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
