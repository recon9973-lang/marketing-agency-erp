"use client";

// 은행 계좌·카드 수동 등록 — 실시간 연동 미구현(미연결)으로 저장. 관리자 이상.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createFinancialAccount } from "@/server/actions/finance";

const inputCls = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand";

export function AddFinancialAccount() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<"BANK" | "CARD">("BANK");
  const [displayName, setDisplayName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [last4, setLast4] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    if (!displayName.trim()) return;
    start(async () => {
      const res = await createFinancialAccount({ type, displayName, institutionName: institutionName || null, last4: last4 || null });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setDisplayName("");
      setInstitutionName("");
      setLast4("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm font-bold text-ink">계좌·카드 등록 (수동)</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">종류</span>
          <select value={type} onChange={(e) => setType(e.target.value as "BANK" | "CARD")} className={inputCls}>
            <option value="BANK">은행 계좌</option>
            <option value="CARD">카드</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">표시 이름 *</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="예: 주거래 통장" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">기관/카드사</span>
          <input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="예: 국민은행" className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">끝 4자리</span>
          <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className={inputCls} />
        </label>
      </div>
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      <button type="button" onClick={submit} disabled={pending || !displayName.trim()} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        <Plus className="h-4 w-4" /> {pending ? "등록 중…" : "등록"}
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
        실시간 자동 연동(오픈뱅킹·카드사 API)은 아직 미구현입니다. 지금은 계좌/카드를 <b>수동 등록</b>하고 거래내역을 수기 입력·대사합니다. 인증키 확보 시 자동 수집으로 전환됩니다.
      </p>
    </div>
  );
}
