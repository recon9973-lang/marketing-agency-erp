"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReport } from "@/server/actions/reports";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function CreateReportForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    const payload = {
      clientId: String(fd.get("clientId") || ""),
      reportingMonth: String(fd.get("reportingMonth") || ""),
      title: String(fd.get("title") || "")
    };
    start(async () => {
      const res = await createReport(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white">
        + 새 보고서
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-xl border border-line bg-white p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">거래처 *</span>
          <select name="clientId" required className={inputCls} defaultValue="">
            <option value="" disabled>선택</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">보고 월 *</span>
          <input name="reportingMonth" type="month" required className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">제목 *</span>
          <input name="title" required placeholder="예: 7월 성과 보고서" className={inputCls} />
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger">
          {error === "VALIDATION" ? "입력값을 확인해 주세요." : error === "DUPLICATE" || error === "CONFLICT" ? "해당 월 보고서가 이미 있습니다." : "저장에 실패했습니다."}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "보고서 생성"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
      </div>
    </form>
  );
}
