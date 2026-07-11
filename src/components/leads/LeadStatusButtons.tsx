// 목표 경로: src/components/leads/LeadStatusButtons.tsx
//
// 리드 상태전이 버튼 — 도메인 LEAD_TRANSITIONS와 동일한 허용표.
// WON은 버튼이 아닌 "거래처 전환"(ConvertLeadButton)으로만 도달한다.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionLead } from "@/server/actions/leads";
import { leadStatusLabels, LEAD_TRANSITIONS, type LeadStatus } from "@/domain/sales/lead-stages";

const TONE: Partial<Record<LeadStatus, string>> = {
  CONTACTING: "bg-blue-600",
  AUDIT: "bg-amber-600",
  MEETING: "bg-violet-600",
  PROPOSAL: "bg-amber-600",
  LOST: "bg-rose-600",
  RECONTACT: "bg-slate-500",
  NEW: "bg-slate-500"
};

export function LeadStatusButtons({ leadId, status, compact = false }: { leadId: string; status: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const targets = (LEAD_TRANSITIONS[status as LeadStatus] ?? []).filter((t) => t !== "WON");
  if (targets.length === 0) return null;

  function run(to: LeadStatus) {
    setError(null);
    let lostReason: string | null = null;
    if (to === "LOST") {
      lostReason = window.prompt("실패 사유를 입력해주세요 (재접촉 판단에 사용)");
      if (lostReason === null) return;
    }
    start(async () => {
      const res = await transitionLead({ id: leadId, to, lostReason });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {targets.map((to) => (
        <button
          key={to}
          onClick={() => run(to)}
          disabled={pending}
          className={`rounded px-2 py-0.5 text-[11px] text-white disabled:opacity-50 ${TONE[to] ?? "bg-slate-500"} ${compact ? "" : "px-2.5 py-1 text-xs"}`}
          aria-label={`${leadStatusLabels[to]}(으)로 이동`}
        >
          {leadStatusLabels[to]}
        </button>
      ))}
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  );
}
