"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
import { createWeeklyReport } from "@/server/actions/weekly-reports";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

/** 이번 주 월요일(YYYY-MM-DD) 기본값. */
function thisMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export type WorklogPick = { id: string; workDate: string; category: string; title: string; link: string | null };

export function CreateWeeklyReportForm({ worklog = [] }: { worklog?: WorklogPick[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [achievements, setAchievements] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function compile() {
    const lines = worklog
      .filter((w) => picked.has(w.id))
      .map((w) => `- [${w.workDate}] ${w.category}: ${w.title}${w.link ? ` (${w.link})` : ""}`);
    if (lines.length === 0) return;
    setAchievements((prev) => (prev.trim() ? `${prev.trim()}\n${lines.join("\n")}` : lines.join("\n")));
    setPicked(new Set());
  }

  function onSubmit(fd: FormData) {
    setError(null);
    const payload = {
      weekStart: String(fd.get("weekStart") || ""),
      summary: String(fd.get("summary") || ""),
      achievements: achievements || null,
      plans: String(fd.get("plans") || "") || null,
      issues: String(fd.get("issues") || "") || null
    };
    start(async () => {
      const res = await createWeeklyReport(payload);
      if (!res.ok) {
        setError(res.error === "DUPLICATE_WEEK" ? "해당 주 보고서가 이미 있습니다." : res.error === "VALIDATION" ? "입력값을 확인해 주세요." : "저장에 실패했습니다.");
        return;
      }
      setOpen(false);
      setAchievements("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
        + 주간보고 작성
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-2xl border border-line bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">주 시작일(월요일) *</span>
          <input name="weekStart" type="date" required defaultValue={thisMonday()} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">한 줄 요약 *</span>
          <input name="summary" required placeholder="예: 신규 거래처 2곳 온보딩 완료" className={inputCls} />
        </label>
      </div>

      {/* 업무 보고(worklog) 다중 선택 취합 */}
      {worklog.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-surface/40 p-3">
          <p className="text-xs font-semibold text-slate-500">이번 주 업무 보고에서 선택해 성과로 취합</p>
          <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {worklog.map((w) => (
              <label key={w.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-white">
                <input type="checkbox" checked={picked.has(w.id)} onChange={() => togglePick(w.id)} className="h-3.5 w-3.5 accent-brand" />
                <span className="shrink-0 text-slate-400">{w.workDate}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{w.category}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{w.title}</span>
              </label>
            ))}
          </div>
          <button type="button" onClick={compile} disabled={picked.size === 0} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft disabled:opacity-40">
            <ListPlus className="h-3.5 w-3.5" /> 선택 {picked.size}건 성과에 추가
          </button>
        </div>
      )}

      <label className="mt-3 block">
        <span className="text-xs font-semibold text-slate-500">이번 주 완료/성과</span>
        <textarea name="achievements" value={achievements} onChange={(e) => setAchievements(e.target.value)} rows={4} placeholder="이번 주에 완료한 업무를 적거나 위에서 업무 보고를 선택해 취합하세요." className={`${inputCls} resize-y`} />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-slate-500">다음 주 계획</span>
        <textarea name="plans" rows={3} placeholder="다음 주 진행 예정 업무." className={`${inputCls} resize-y`} />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-slate-500">이슈/공유사항</span>
        <textarea name="issues" rows={2} placeholder="공유할 이슈나 도움이 필요한 사항." className={`${inputCls} resize-y`} />
      </label>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "제출(결재 상신)"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">제출하면 담당자 → 관리자 → 최고관리자 순으로 결재됩니다(승인함).</p>
    </form>
  );
}
