// 목표 경로: src/components/reports/GenerateMonthlyReport.tsx
//
// 월간 보고서 자동 생성 — 거래처·월 선택 시 계약·업무·순위·콘텐츠를 집계해 초안 생성.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { generateMonthlyReport } from "@/server/actions/reports";

const inputCls = "rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function GenerateMonthlyReport({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState(thisMonth());
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function run() {
    setError(null);
    setOk(false);
    if (!clientId) return setError("거래처를 선택하세요.");
    start(async () => {
      const res = await generateMonthlyReport({ clientId, reportingMonth: month });
      if (!res.ok) {
        setError("자동 생성에 실패했습니다.");
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-sm font-bold text-ink">월간 보고서 자동 생성</p>
      <p className="mt-1 text-xs text-slate-500">계약 상품·완료 업무·순위·게시 콘텐츠를 집계해 지표가 채워진 초안을 만듭니다.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
          <option value="">거래처 선택</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} />
        <button type="button" onClick={run} disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <Wand2 className="h-4 w-4" /> {pending ? "집계 중…" : "자동 생성"}
        </button>
        {ok ? <span className="text-sm text-emerald-600">생성됨 — 아래 목록에서 확인·편집하세요.</span> : null}
        {error ? <span className="text-sm text-danger">{error}</span> : null}
      </div>
    </div>
  );
}
