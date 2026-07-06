"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

export function CreateWeeklyReportForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    const payload = {
      weekStart: String(fd.get("weekStart") || ""),
      summary: String(fd.get("summary") || ""),
      achievements: String(fd.get("achievements") || "") || null,
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
    <form action={onSubmit} className="rounded-xl border border-line bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">주 시작일(월요일) *</span>
          <input name="weekStart" type="date" required defaultValue={thisMonday()} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">한 줄 요약 *</span>
          <input name="summary" required placeholder="예: 신규 거래처 2곳 온보딩 완료" className={inputCls} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-slate-500">이번 주 완료/성과</span>
        <textarea name="achievements" rows={3} placeholder="이번 주에 완료한 업무를 적어주세요." className={`${inputCls} resize-y`} />
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
          {pending ? "저장 중…" : "제출"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
      </div>
    </form>
  );
}
