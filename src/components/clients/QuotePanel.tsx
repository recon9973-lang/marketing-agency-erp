// 목표 경로: src/components/clients/QuotePanel.tsx
//
// 견적서 3종(BASIC/STANDARD/PREMIUM) — 상품 마스터 기반 생성 + 상태 관리.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { generateQuoteSet, updateQuoteStatus } from "@/server/actions/quotes";

type Item = { productId: string | null; name: string; monthlyFee: number; quantity: number };
type Quote = { id: string; tier: string; items: Item[]; monthlyTotal: number; status: string; createdAt: string };

const won = new Intl.NumberFormat("ko-KR");
const TIER_LABEL: Record<string, string> = { BASIC: "베이직", STANDARD: "스탠다드", PREMIUM: "프리미엄" };
const STATUS_LABEL: Record<string, string> = { DRAFT: "초안", SENT: "발송됨", ACCEPTED: "수락", REJECTED: "거절" };
const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;

export function QuotePanel({ clientId, quotes, canManage }: { clientId: string; quotes: Quote[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    start(async () => {
      const res = await generateQuoteSet({ clientId });
      if (!res.ok) setError("견적 생성에 실패했습니다.");
      else router.refresh();
    });
  }

  function setStatus(id: string, status: string) {
    start(async () => {
      const res = await updateQuoteStatus({ id, status });
      if (!res.ok) setError("상태 변경에 실패했습니다.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {canManage ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">상품 마스터 기반 3종 견적을 생성합니다. 초안 재생성 시 기존 초안은 대체됩니다.</p>
          <button type="button" onClick={generate} disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <FileSpreadsheet className="h-4 w-4" /> {pending ? "생성 중…" : quotes.length ? "견적 재생성" : "견적 3종 생성"}
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {quotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-8 text-center text-sm text-slate-500">아직 견적이 없습니다.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {quotes.map((q) => (
            <div key={q.id} className={`rounded-xl border bg-white p-4 ${q.status === "ACCEPTED" ? "border-brand" : "border-line"}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink">{TIER_LABEL[q.tier] ?? q.tier}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${q.status === "ACCEPTED" ? "bg-brand-soft text-brand-strong" : q.status === "REJECTED" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                  {STATUS_LABEL[q.status] ?? q.status}
                </span>
              </div>
              <p className="mt-2 text-xl font-bold text-brand-strong">{won.format(q.monthlyTotal)}<span className="text-xs font-normal text-slate-400">원/월</span></p>
              <ul className="mt-3 space-y-1 border-t border-line pt-3">
                {q.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{it.name}</span>
                    <span className="text-slate-400">{won.format(it.monthlyFee)}원</span>
                  </li>
                ))}
              </ul>
              {canManage ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {STATUSES.map((s) => (
                    <button key={s} type="button" onClick={() => setStatus(q.id, s)} disabled={pending || q.status === s}
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${q.status === s ? "bg-brand text-white" : "border border-line text-slate-500 hover:bg-surface"}`}>
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
