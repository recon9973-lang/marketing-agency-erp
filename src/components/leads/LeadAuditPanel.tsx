// 목표 경로: src/components/leads/LeadAuditPanel.tsx
//
// 무료진단 패널 — VENOM SEO 엔진(총괄 디렉터 단일 정본) 자동 진단이 메인.
// 리드 홈페이지 URL을 서버에서 엔진에 태워 6영역 실측 채점 → 결과 저장.
// 하단의 §11 8항목 수동 체크리스트는 엔진이 볼 수 없는 정성 항목(플레이스/CTA 등) 보조용.
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runLeadSeoAudit, saveLeadAudit } from "@/server/actions/leads";
import { AUDIT_CHECKLIST_ITEMS, computeAuditScore, type AuditChecklist } from "@/domain/sales/lead-stages";
import type { SeoEngineResult, SeoEngineCategory } from "@/server/seo-engine";

const AUDIT_ERR: Record<string, string> = {
  AUDIT_INVALID_URL: "홈페이지 URL 형식이 올바르지 않습니다.",
  AUDIT_NO_WEBSITE: "이 리드에 홈페이지 URL이 없습니다. 먼저 URL을 등록하세요.",
  AUDIT_FETCH_FAILED: "사이트에 접속하지 못했습니다(네트워크/차단).",
  AUDIT_NOT_RENDERED: "정적 HTML에 콘텐츠가 없습니다(SPA/봇차단) — 렌더링 수집 필요.",
  NO_WEBSITE: "이 리드에 홈페이지 URL이 없습니다."
};

function barColor(pct: number): string {
  if (pct >= 80) return "#16a34a";
  if (pct >= 60) return "#d97706";
  return "#dc2626";
}

function CategoryBars({ categories }: { categories: SeoEngineCategory[] }) {
  return (
    <div className="mt-3 grid gap-2">
      {categories.map((c) => {
        const pct = c.pending ? 0 : c.pct;
        return (
          <div key={c.key} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-xs sm:grid-cols-[9rem_1fr_3.5rem]">
            <span className="truncate text-slate-600" title={c.label}>
              {c.icon} {c.label}
            </span>
            <span className="h-2 rounded-full bg-surface">
              <span
                className="block h-full rounded-full"
                style={{ width: `${c.pending ? 0 : pct}%`, background: c.pending ? "#cbd5e1" : barColor(pct) }}
              />
            </span>
            <span className="text-right font-semibold tabular-nums text-ink">
              {c.pending ? "대기" : `${c.score}/${c.max}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EngineResult({ result, runAt, version }: { result: SeoEngineResult; runAt: string | null; version: string | null }) {
  const fails = result.categories
    .flatMap((c) => c.items.filter((i) => i.pass === false).map((i) => ({ cat: c.label, ...i })))
    .sort((a, b) => b.points - a.points);
  const pct = result.max ? Math.round((result.total / result.max) * 100) : 0;
  return (
    <div className="mt-3 rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <span className="text-2xl font-bold text-ink tabular-nums">{result.total}</span>
          <span className="text-xs text-slate-400"> / {result.max} · {pct}점</span>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
          style={{ background: result.grade.color }}
        >
          {result.grade.label}
        </span>
        <span className="text-xs text-slate-500">
          통과 {result.summary.passed} · 개선 {result.summary.failed}
          {result.summary.pending ? ` · 대기 ${result.summary.pending}` : ""}
        </span>
        {runAt && (
          <span className="ml-auto text-[10px] text-slate-400">
            엔진 v{version} · {new Date(runAt).toLocaleString("ko-KR")}
          </span>
        )}
      </div>
      <CategoryBars categories={result.categories} />
      {fails.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-600">개선 항목 (배점순)</p>
          <ul className="mt-1 space-y-1">
            {fails.slice(0, 8).map((f, i) => (
              <li key={i} className="rounded-md border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-rose-700">✗ {f.name}</span>
                <span className="text-slate-400"> · {f.cat} · +{f.points}</span>
                <p className="mt-0.5 text-slate-600">{f.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LeadAuditPanel({
  leadId,
  websiteUrl,
  initialChecklist,
  initialScore,
  initialNote,
  initialAuditResult,
  initialEngineVersion,
  initialRunAt
}: {
  leadId: string;
  websiteUrl: string | null;
  initialChecklist: Record<string, boolean>;
  initialScore: number | null;
  initialNote: string | null;
  initialAuditResult: SeoEngineResult | null;
  initialEngineVersion: string | null;
  initialRunAt: string | null;
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<Record<string, boolean>>(initialChecklist);
  const [note, setNote] = useState(initialNote ?? "");
  const [keyword, setKeyword] = useState("");
  const [pending, start] = useTransition();
  const [running, startRun] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [savedScore, setSavedScore] = useState<number | null>(initialScore);
  const [result, setResult] = useState<SeoEngineResult | null>(initialAuditResult);
  const [runAt, setRunAt] = useState<string | null>(initialRunAt);

  const liveScore = useMemo(() => computeAuditScore(checklist as AuditChecklist), [checklist]);

  function toggle(key: string) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function runEngine() {
    setRunError(null);
    startRun(async () => {
      const res = await runLeadSeoAudit({ id: leadId, keyword: keyword || null });
      if (!res.ok) setRunError(AUDIT_ERR[res.error] ?? `진단 실패 (${res.error})`);
      else {
        setRunAt(new Date().toISOString());
        router.refresh();
      }
    });
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveLeadAudit({ id: leadId, checklist, auditNote: note || null });
      if (!res.ok) setError(res.error);
      else {
        setSavedScore(res.data?.score ?? liveScore);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      {/* VENOM 엔진 자동 진단 (메인) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-ink">SEO 자동 진단 · VENOM 엔진</h2>
          <p className="text-[11px] text-slate-400">총괄 디렉터 단일 정본 엔진 · 규칙 29 / 6영역</p>
        </div>
        <button
          onClick={runEngine}
          disabled={running || !websiteUrl}
          className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          title={!websiteUrl ? "홈페이지 URL을 먼저 등록하세요" : undefined}
        >
          {running ? "진단 중…" : result ? "재진단" : "자동 진단 실행"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="포커스 키워드(선택) 예: 임플란트"
          className="min-w-0 flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink"
        />
        {websiteUrl ? (
          <span className="truncate text-[11px] text-slate-400" title={websiteUrl}>
            대상 {websiteUrl}
          </span>
        ) : (
          <span className="text-[11px] text-amber-600">홈페이지 URL 없음</span>
        )}
      </div>
      {runError && <p className="mt-2 text-xs text-rose-600">{runError}</p>}
      {result ? (
        <EngineResult result={result} runAt={runAt} version={initialEngineVersion} />
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-slate-400">
          아직 진단 결과가 없습니다. 홈페이지 URL을 대상으로 자동 진단을 실행하세요.
        </p>
      )}

      {/* §11 수동 체크리스트 (엔진이 못 보는 정성 항목 보조) */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">보조 체크리스트 (수동)</h3>
          <div className="text-right">
            <span className="text-lg font-bold text-ink">{liveScore}</span>
            <span className="text-xs text-slate-400"> /100</span>
            {savedScore !== null && savedScore !== liveScore && (
              <p className="text-[10px] text-amber-600">저장 필요</p>
            )}
          </div>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AUDIT_CHECKLIST_ITEMS.map((item) => (
            <li key={item.key}>
              <label className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={checklist[item.key] === true} onChange={() => toggle(item.key)} />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
        <label className="mt-3 block text-xs font-medium text-slate-600">
          브리핑 메모 (문제 3개 · 기회 3개 — 15분 브리핑 자료)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={4000}
            className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink"
            placeholder={"문제: ①색인 누락 ②메타 중복 ③CTA 부재\n기회: ①진료과 랜딩 ②FAQ 구조화 ③플레이스 연동"}
          />
        </label>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        <button
          onClick={save}
          disabled={pending}
          className="mt-3 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "저장 중…" : "체크리스트 저장"}
        </button>
      </div>
    </div>
  );
}
