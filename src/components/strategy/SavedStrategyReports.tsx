"use client";

/**
 * 저장된 마케팅 전략 상담 리포트 — 최근 목록 + 클릭 시 브리프 열람.
 * 저장은 StrategyAnalysis의 "상담 리포트로 저장"에서. 여기선 재조회만.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getStrategyReport, updateStrategyReportStatus, deleteStrategyReport, type StrategyReportListItem, type StrategyReportFull } from "@/server/actions/strategy";
import { FileText, Copy, Check, X, Share2, Undo2, Trash2 } from "lucide-react";

const CARD = "rounded-2xl border border-line bg-card p-4";

export function SavedStrategyReports({ reports }: { reports: StrategyReportListItem[] }) {
  const [open, setOpen] = useState<StrategyReportFull | null>(null);
  const [pending, start] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  function view(id: string) {
    start(async () => {
      const r = await getStrategyReport(id);
      if (r.ok) setOpen(r.data);
    });
  }

  function toggleStatus() {
    if (!open) return;
    const next = open.status === "SHARED" ? "DRAFT" : "SHARED";
    startMutate(async () => {
      const r = await updateStrategyReportStatus(open.id, next);
      if (r.ok) {
        setOpen({ ...open, status: next });
        router.refresh();
      }
    });
  }

  function remove() {
    if (!open || !confirm("이 상담 리포트를 삭제할까요? 되돌릴 수 없습니다.")) return;
    startMutate(async () => {
      const r = await deleteStrategyReport(open.id);
      if (r.ok) {
        setOpen(null);
        router.refresh();
      }
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
              {r.status === "SHARED" && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">공유</span>}
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">{r.createdAt.slice(0, 10)}</span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div className="mt-3 rounded-xl border border-line bg-surface/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
              {open.hospitalName} · {open.createdAt.slice(0, 10)}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${open.status === "SHARED" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>{open.status === "SHARED" ? "공유" : "초안"}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleStatus} disabled={mutating} className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-2 py-1 text-[11.5px] font-semibold text-slate-600 transition hover:bg-surface/60 disabled:opacity-50 dark:text-slate-300">
                {open.status === "SHARED" ? <><Undo2 className="h-3 w-3" /> 초안으로</> : <><Share2 className="h-3 w-3" /> 공유</>}
              </button>
              <button onClick={copyBrief} className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-2 py-1 text-[11.5px] font-semibold text-slate-600 transition hover:bg-surface/60 dark:text-slate-300">
                {copied ? <><Check className="h-3 w-3 text-emerald-500" /> 복사됨</> : <><Copy className="h-3 w-3" /> 복사</>}
              </button>
              <button onClick={remove} disabled={mutating} className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-card px-2 py-1 text-[11.5px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20"><Trash2 className="h-3 w-3" /> 삭제</button>
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
