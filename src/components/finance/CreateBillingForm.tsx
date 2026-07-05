"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBilling } from "@/server/actions/finance";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

export function CreateBillingForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    const issued = String(fd.get("issuedAmount") || "");
    const due = String(fd.get("dueDate") || "");
    const payload: Record<string, unknown> = {
      clientId: String(fd.get("clientId") || ""),
      billingMonth: String(fd.get("billingMonth") || ""),
      contractAmount: Number(fd.get("contractAmount") || 0)
    };
    if (issued) payload.issuedAmount = Number(issued);
    if (due) payload.dueDate = due;
    start(async () => {
      const res = await createBilling(payload);
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
        + 청구 등록
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-xl border border-line bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">거래처 *</span>
          <select name="clientId" required className={inputCls} defaultValue="">
            <option value="" disabled>선택</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">청구 월 *</span>
          <input name="billingMonth" type="month" required className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">계약금액 *</span>
          <input name="contractAmount" type="number" min="0" required placeholder="원" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">청구금액</span>
          <input name="issuedAmount" type="number" min="0" placeholder="미입력 시 계약금액" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">납기일</span>
          <input name="dueDate" type="date" className={inputCls} />
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger">
          {error === "VALIDATION" ? "입력값을 확인해 주세요." : error === "DUPLICATE" || error === "CONFLICT" ? "해당 월 청구가 이미 있습니다." : "저장에 실패했습니다."}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "청구 등록"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
      </div>
    </form>
  );
}
