// GEO Studio · M5 채널 플래너 화면 — 입력 → 계획 계산(서버액션) → 결과 표시.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { planGeoCampaign, saveGeoCampaignPlan, type GeoPlanResult } from "@/server/actions/geo-planner";

const GOAL_LABELS: Record<string, string> = {
  citation_rate: "AI 인용율",
  cep_coverage: "CEP 커버리지",
  ta_score: "Topical Authority",
  roi: "ROI"
};

const won = (n: number) => n.toLocaleString("ko-KR") + "원";

type Alloc = {
  channel: string;
  budget_pct: number;
  budget_allocation: number;
  content_count: number;
  content_types: string[];
  expected_citation_boost: number;
};
type Summary = {
  period: string;
  task_count: number;
  task_status: Record<string, number>;
  expected_citation_boost_pp: number;
  estimated_roi_pct: number;
  estimated_revenue: number;
  channel_mix: { recommended_mix: Alloc[]; total_expected_citation_boost: number } | null;
};

const DEFAULTS = {
  name: "Q3 GEO 캠페인",
  industry: "카페",
  goalType: "citation_rate",
  targetValue: 25,
  deadlineDays: 90,
  budget: 5_000_000,
  teamSize: 3,
  priorityCepCount: 5,
  team: "김민수, 이서연, 박지훈",
  citationRate: 18,
  cepCoverage: 55,
  taScore: 62,
  totalCeps: 20,
  coveredCeps: 11
};

function Num({
  label,
  value,
  onChange,
  step = 1,
  suffix
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      {suffix ? <span className="text-slate-400"> ({suffix})</span> : null}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink focus:border-emerald-400 focus:outline-none"
      />
    </label>
  );
}

export function GeoPlannerForm() {
  const [f, setF] = useState(DEFAULTS);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<GeoPlanResult | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) => setF((s) => ({ ...s, [k]: v }));

  // 계산·저장이 공유하는 입력 페이로드.
  const payload = () => ({
    name: f.name,
    industry: f.industry,
    goalType: f.goalType,
    targetValue: f.targetValue,
    deadlineDays: f.deadlineDays,
    budget: f.budget,
    teamSize: f.teamSize,
    priorityCepCount: f.priorityCepCount,
    team: f.team.split(",").map((s) => s.trim()).filter(Boolean),
    citationRate: f.citationRate,
    cepCoverage: f.cepCoverage,
    taScore: f.taScore,
    totalCeps: f.totalCeps,
    coveredCeps: f.coveredCeps
  });

  function submit() {
    setErr(null);
    setSaved(false);
    start(async () => {
      const out = await planGeoCampaign(payload());
      if (!out.ok) setErr(out.error ?? "계획 생성 실패");
      else setRes(out.data ?? null);
    });
  }

  function save() {
    setErr(null);
    start(async () => {
      const out = await saveGeoCampaignPlan(payload());
      if (!out.ok) setErr(out.error ?? "계획 저장 실패");
      else {
        setSaved(true);
        router.refresh(); // 하단 저장목록 갱신
      }
    });
  }

  const summary = res?.summary as unknown as Summary | undefined;

  return (
    <div className="space-y-4">
      {/* 입력 폼 */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-3 text-sm font-bold text-ink">캠페인 입력</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            캠페인명
            <input value={f.name} onChange={(e) => set("name", e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink focus:border-emerald-400 focus:outline-none" />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            업종
            <input value={f.industry} onChange={(e) => set("industry", e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink focus:border-emerald-400 focus:outline-none" />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            목표 유형
            <select value={f.goalType} onChange={(e) => set("goalType", e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink focus:border-emerald-400 focus:outline-none">
              {Object.entries(GOAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <Num label="목표 수치" value={f.targetValue} onChange={(v) => set("targetValue", v)} />
          <Num label="마감" suffix="일" value={f.deadlineDays} onChange={(v) => set("deadlineDays", v)} />
          <Num label="예산" suffix="원" value={f.budget} step={100000} onChange={(v) => set("budget", v)} />
          <Num label="팀 규모" value={f.teamSize} onChange={(v) => set("teamSize", v)} />
          <label className="col-span-2 block text-xs font-medium text-slate-600">
            담당자 (쉼표 구분)
            <input value={f.team} onChange={(e) => set("team", e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink focus:border-emerald-400 focus:outline-none" />
          </label>
          <Num label="우선순위 CEP 수" value={f.priorityCepCount} onChange={(v) => set("priorityCepCount", v)} />
        </div>

        <p className="mb-2 mt-4 text-xs font-semibold text-slate-500">현재 상태 (M1~M4 지표)</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Num label="AI 인용율" suffix="%" value={f.citationRate} onChange={(v) => set("citationRate", v)} />
          <Num label="CEP 커버리지" suffix="%" value={f.cepCoverage} onChange={(v) => set("cepCoverage", v)} />
          <Num label="Topical Authority" value={f.taScore} onChange={(v) => set("taScore", v)} />
          <Num label="총 CEP 수" value={f.totalCeps} onChange={(v) => set("totalCeps", v)} />
          <Num label="커버된 CEP" value={f.coveredCeps} onChange={(v) => set("coveredCeps", v)} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? "계획 생성 중…" : "🚀 캠페인 계획 생성"}
          </button>
          {err && <span className="text-xs text-rose-600">{err}</span>}
        </div>
      </div>

      {/* 결과 */}
      {res && summary && (
        <div className="space-y-4">
          {/* 저장 — 계획 산출물 영속화(새로고침 소실 방지) */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {saved ? <span className="text-xs font-semibold text-emerald-600">✓ 저장됨 · 아래 목록에서 재열람</span> : null}
            <button type="button" onClick={save} disabled={pending} className="rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand-strong hover:bg-brand-soft disabled:opacity-50">
              {pending ? "저장 중…" : "계획 저장"}
            </button>
          </div>

          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "예상 인용율 상승", value: `+${summary.expected_citation_boost_pp}%p`, tone: "text-emerald-600" },
              { label: "예상 ROI", value: `${summary.estimated_roi_pct}%`, tone: summary.estimated_roi_pct >= 0 ? "text-emerald-600" : "text-rose-600" },
              { label: "예상 기여 매출", value: won(summary.estimated_revenue), tone: "text-ink" },
              { label: "실행 태스크", value: `${summary.task_count}건`, tone: "text-ink" }
            ].map((c) => (
              <div key={c.label} className="rounded-2xl border border-line bg-card p-4">
                <p className="text-[11px] text-slate-500">{c.label}</p>
                <p className={`text-xl font-bold ${c.tone}`}>{c.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">기간: {summary.period} · 목표 {GOAL_LABELS[f.goalType]} {f.targetValue}</p>

          {/* KPI 진척 */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="mb-3 text-sm font-bold text-ink">KPI 진척</p>
            <div className="space-y-2.5">
              {res.kpi.map((k) => {
                const kk = k as { metric: string; current: number; target: number; progress_pct: number; remaining: number };
                return (
                  <div key={kk.metric}>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{kk.metric}</span>
                      <span className="text-slate-400">
                        {kk.current} / {kk.target} · {kk.progress_pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-surface">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, kk.progress_pct))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 채널 믹스 */}
          {summary.channel_mix && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-card">
              <div className="flex items-center justify-between px-4 pt-4">
                <p className="text-sm font-bold text-ink">채널 믹스</p>
                <p className="text-[11px] font-semibold text-emerald-600">총 예상 인용 상승 +{summary.channel_mix.total_expected_citation_boost}%p</p>
              </div>
              <table className="mt-2 w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="border-y border-line bg-surface text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-2">채널</th>
                    <th className="px-2 py-2">예산%</th>
                    <th className="px-2 py-2">예산</th>
                    <th className="px-2 py-2">콘텐츠</th>
                    <th className="px-2 py-2">예상 상승</th>
                    <th className="px-2 py-2">유형</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.channel_mix.recommended_mix.map((a) => (
                    <tr key={a.channel} className="border-t border-line">
                      <td className="px-4 py-2 font-medium text-ink">{a.channel}</td>
                      <td className="px-2 py-2 text-slate-600">{a.budget_pct}%</td>
                      <td className="px-2 py-2 text-slate-600">{won(a.budget_allocation)}</td>
                      <td className="px-2 py-2 text-slate-600">{a.content_count}건</td>
                      <td className="px-2 py-2 font-semibold text-emerald-600">+{a.expected_citation_boost}%p</td>
                      <td className="px-2 py-2 text-[11px] text-slate-400">{a.content_types.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 실행 캘린더 */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="mb-3 text-sm font-bold text-ink">실행 캘린더 · {res.campaign.taskCount}개 태스크</p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {Object.entries(res.calendar).map(([date, items]) => (
                <div key={date} className="flex gap-3 border-b border-line pb-2 last:border-0">
                  <span className="w-24 shrink-0 text-xs font-semibold text-slate-500">{date}</span>
                  <div className="flex-1 space-y-1">
                    {items.map((it, i) => {
                      const t = it as { title: string; assignee: string; type: string };
                      return (
                        <p key={i} className="text-xs text-slate-600">
                          {t.title} <span className="text-slate-400">· {t.assignee}</span>
                        </p>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 경영진 리포트 */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <button type="button" onClick={() => setShowReport((s) => !s)} className="text-sm font-bold text-ink">
              경영진 리포트 (마크다운) {showReport ? "▲" : "▼"}
            </button>
            {showReport && (
              <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-[12px] leading-relaxed text-slate-700">
                {res.report}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
