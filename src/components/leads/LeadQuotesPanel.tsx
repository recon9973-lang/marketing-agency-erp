// 목표 경로: src/components/leads/LeadQuotesPanel.tsx
//
// 제안발송 단계 견적 3안(입문/성장/구축) — 거래처 전환 전 리드에 직접 발급.
// 모든 견적에 미보장 고지가 자동 포함되며(제안 전 게이트), 전환 시 거래처로 링크된다.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateLeadQuoteSet, updateQuoteStatus } from "@/server/actions/quotes";
import type { QuoteView } from "@/server/repositories/quotes";

const TIER_LABEL: Record<string, string> = { BASIC: "입문(진단)", STANDARD: "성장(월 운영)", PREMIUM: "구축(신규+GEO)" };
const STATUS_LABEL: Record<string, string> = { DRAFT: "작성", SENT: "발송", ACCEPTED: "수락", REJECTED: "거절" };
const won = new Intl.NumberFormat("ko-KR");

export function LeadQuotesPanel({ leadId, quotes, disclaimer }: { leadId: string; quotes: QuoteView[]; disclaimer: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    start(async () => {
      const res = await generateLeadQuoteSet({ leadId });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function setStatus(id: string, status: "SENT" | "ACCEPTED" | "REJECTED") {
    start(async () => {
      const res = await updateQuoteStatus({ id, status });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">제안 견적 (3안)</h2>
        <button type="button" onClick={generate} disabled={pending} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
          {quotes.length > 0 ? "3안 다시 생성" : "견적 3안 생성"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      {quotes.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          아직 견적이 없습니다. 입문(진단)·성장(월 운영)·구축(신규+GEO) 3안을 생성해 제안에 사용하세요.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {quotes.map((q) => (
            <li key={q.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm text-ink">{TIER_LABEL[q.tier] ?? q.tier}</b>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  {STATUS_LABEL[q.status] ?? q.status}
                </span>
                <span className="ml-auto text-sm font-bold text-ink num" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {won.format(q.monthlyTotal)}원
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                {q.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ""}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{won.format(it.monthlyFee)}원</span>
                  </li>
                ))}
              </ul>
              {q.status === "DRAFT" && (
                <div className="mt-2 flex gap-1.5 border-t border-line pt-2">
                  <button type="button" onClick={() => setStatus(q.id, "SENT")} disabled={pending} className="rounded bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold text-white disabled:opacity-50">발송 처리</button>
                </div>
              )}
              {q.status === "SENT" && (
                <div className="mt-2 flex gap-1.5 border-t border-line pt-2">
                  <button type="button" onClick={() => setStatus(q.id, "ACCEPTED")} disabled={pending} className="rounded bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white disabled:opacity-50">수락</button>
                  <button type="button" onClick={() => setStatus(q.id, "REJECTED")} disabled={pending} className="rounded bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white disabled:opacity-50">거절</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 rounded-lg bg-surface/60 p-2.5 text-[11px] leading-relaxed text-slate-500">{disclaimer}</p>
    </div>
  );
}
