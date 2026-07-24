"use client";

/**
 * 저장된 마케팅 전략 상담 리포트 — 최근 목록 + 클릭 시 브리프 열람.
 * 저장은 StrategyAnalysis의 "상담 리포트로 저장"에서. 여기선 재조회만.
 */
import { useState, useTransition } from "react";
import { getStrategyReport, type StrategyReportListItem, type StrategyReportFull } from "@/server/actions/strategy";
import { FileText, Copy, Check, X } from "lucide-react";

const CARD = "rounded-2xl border border-line bg-card p-4";

export function SavedStrategyReports({ reports }: { reports: StrategyReportListItem[] }) {
  const [open, setOpen] = useState<StrategyReportFull | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function view(id: string) {
    start(async () => {
      const r = await getStrategyReport(id);
      if (r.ok) setOpen(r.data);
    });
  }
  async function copyBrief() {
    if (!open?.brief) return;
    try {
      await navigator.clipboard.writeText(open.brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 무시 */
    }
  }

  if (reports.length === 0) {
    return (
      <div className={CARD}>
        <h3 className="text-sm font-bold text-ink">💾 저장된 상담 리포트</h3>
        <p className="mt-2 text-[12.5px] text-slate-400">아직 저장된 리포트가 없습니다. 위에서 전략 분석 후 “상담 리포트로 저장”을 누르면 여기에 쌓입니다.</p>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <h3 className="text-sm font-bold text-ink">💾 저장된 상담 리포트 <span className="font-normal text-slate-400">최근 {reports.length}건</span></h3>
      <ul className="mt-2 divide-y divide-line/60">
        {reports.map((r) => (
          <li key={r.id}>
            <button onClick={() => view(r.id)} disabled={pending} className="flex w-full items-baseline gap-2 py-2.5 text-left transition hover:opacity-70 disabled:opacity-50">
              <FileText className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-brand" />
              <span className="font-semibold text-ink">{r.hospitalName}</span>
              {r.departments && <span className="text-[11.5px] text-slate-400">{r.departments}</span>}
              <span className="text-[11.5px] text-slate-400">{r.address}</span>
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">{r.createdAt.slice(0, 10)}</span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="mt-3 rounded-xl border border-line bg-surface/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-bold text-ink">{open.hospitalName} · {open.createdAt.slice(0, 10)}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={copyBrief} className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-2 py-1 text-[11.5px] font-semibold text-slate-600 transition hover:bg-surface/60 dark:text-slate-300">
                {copied ? <><Check className="h-3 w-3 text-emerald-500" /> 복사됨</> : <><Copy className="h-3 w-3" /> 복사</>}
              </button>
              <button onClick={() => setOpen(null)} className="rounded-md border border-line bg-card p-1 text-slate-500 transition hover:bg-surface/60"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          {open.brief ? (
            <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg border border-line bg-card p-3 text-[11px] leading-relaxed text-ink whitespace-pre-wrap">{open.brief}</pre>
          ) : (
            <p className="mt-2 text-[12px] text-slate-400">브리프 내용이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
