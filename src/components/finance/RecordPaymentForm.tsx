"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPayment } from "@/server/actions/finance";

const inputCls = "mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

const METHODS: { value: string; label: string }[] = [
  { value: "BANK_TRANSFER", label: "계좌이체" },
  { value: "CARD", label: "카드" },
  { value: "CASH", label: "현금" },
  { value: "VIRTUAL_ACCOUNT", label: "가상계좌" },
  { value: "OTHER", label: "기타" }
];

export function RecordPaymentForm({ billings }: { billings: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    const received = String(fd.get("receivedAt") || "");
    const payload: Record<string, unknown> = {
      billingRecordId: String(fd.get("billingRecordId") || ""),
      amount: Number(fd.get("amount") || 0),
      method: String(fd.get("method") || "BANK_TRANSFER")
    };
    if (received) payload.receivedAt = received;
    start(async () => {
      const res = await recordPayment(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (billings.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface">
        + 입금 기록
      </button>
    );
  }

  return (
    <form action={onSubmit} className="rounded-2xl border border-line bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="block lg:col-span-2">
          <span className="text-xs font-semibold text-slate-500">청구 건 *</span>
          <select name="billingRecordId" required className={inputCls} defaultValue="">
            <option value="" disabled>선택</option>
            {billings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">입금액 *</span>
          <input name="amount" type="number" min="1" required placeholder="원" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">수단</span>
          <select name="method" className={inputCls} defaultValue="BANK_TRANSFER">
            {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">입금일</span>
          <input name="receivedAt" type="date" className={inputCls} />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error === "VALIDATION" ? "입력값을 확인해 주세요." : "저장에 실패했습니다."}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "저장 중…" : "입금 기록"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line px-4 py-2 text-sm text-slate-600">취소</button>
      </div>
    </form>
  );
}
