"use client";

// SEO 진단 — URL 입력 → VENOM 엔진 실측 → 점수 + 부족항목(수정할 내용) 정리.
import { useState, useTransition } from "react";
import { Search, ShieldCheck, AlertTriangle } from "lucide-react";
import { runSeoDiagnosis } from "@/server/actions/seo";
import type { SeoEngineResult } from "@/server/seo-engine";

const inputCls = "w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand";

export function SeoDiagnose({ presetUrl }: { presetUrl?: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState(presetUrl ?? "");
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeoEngineResult | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [meta, setMeta] = useState<{ version: string; fetchedWith: string } | null>(null);

  function run() {
    setError(null);
    if (!url.trim()) return;
    start(async () => {
      const res = await runSeoDiagnosis({ url, keyword: keyword || null });
      if (!res.ok) {
        setError(res.code === "SEO_FETCH_FAILED" ? "페이지를 불러오지 못했습니다. URL을 확인해 주세요." : res.error);
        setResult(null);
        setMeta(null);
        return;
      }
      setResult(res.data?.result ?? null);
      setScore(res.data?.score ?? null);
      setMeta(res.data ? { version: res.data.version, fetchedWith: res.data.fetchedWith } : null);
    });
  }

  const fetchedLabel = meta?.fetchedWith === "googlebot" ? "실측 · Googlebot UA" : "실측 · 브라우저 UA";

  const fails = result
    ? result.categories.flatMap((c) => c.items.filter((i) => i.pass === false).map((i) => ({ cat: c.label, name: i.name, desc: i.desc, points: i.points })))
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="진단할 URL (예: example.com)" className={inputCls} />
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="핵심 키워드 (선택)" className={inputCls} />
          </div>
          <button type="button" onClick={run} disabled={pending || !url.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50">
            <Search className="h-4 w-4" /> {pending ? "진단 중…" : "SEO 진단"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <p className="mt-2 text-[11px] text-slate-400">실제 페이지를 불러와 VENOM 엔진으로 실측 진단합니다(HTML 구조·메타·색인·속도 등).</p>
      </div>

      {result && (
        <>
          {/* 점수 요약 */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card p-5">
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-4" style={{ borderColor: result.grade.color }}>
              <span className="text-2xl font-bold text-ink">{score ?? result.total}</span>
              <span className="text-[10px] text-slate-400">/ 100</span>
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold" style={{ color: result.grade.color }}>{result.grade.label}</p>
              <p className="text-sm text-slate-600">{result.grade.desc}</p>
              <p className="mt-1 text-xs text-slate-400">
                통과 {result.summary.passed} · 개선필요 {result.summary.failed} · {result.domain}
              </p>
              {meta && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full border border-brand/30 bg-brand-soft px-2 py-0.5 font-semibold text-brand-strong">VENOM SEO 엔진 v{meta.version}</span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">{fetchedLabel}</span>
                  <span className="text-slate-400">정본 파이프라인(배포 시 자동 동기화)</span>
                </p>
              )}
            </div>
          </div>

          {/* 카테고리 점수 바 */}
          <div className="rounded-2xl border border-line bg-card p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">항목별 점수</h3>
            <div className="space-y-2">
              {result.categories.map((c) => (
                <div key={c.key} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-2 text-xs">
                  <span className="truncate text-slate-600">{c.label}</span>
                  <span className="h-2 rounded-full bg-surface">
                    <span className="block h-2 rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                  </span>
                  <span className="text-right tabular-nums text-slate-500">{c.pending ? "대기" : `${c.score}/${c.max}`}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 부족한 부분 — 수정할 내용 */}
          <div className="rounded-2xl border border-line bg-card p-5">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
              {fails.length === 0 ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
              수정할 내용 <span className="text-slate-400">({fails.length})</span>
            </h3>
            {fails.length === 0 ? (
              <p className="text-sm text-emerald-700">부족한 항목이 없습니다. 우수한 상태입니다.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {fails.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">+{f.points}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{f.name}</span>
                      <span className="block text-xs leading-relaxed text-slate-500">{f.desc}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-400">{f.cat}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
