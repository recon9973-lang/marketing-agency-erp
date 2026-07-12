// 목표 경로: src/components/leads/LeadStatusButtons.tsx
//
// 리드 상태전이 버튼 — 도메인 LEAD_TRANSITIONS와 동일한 허용표.
// WON은 버튼이 아닌 "거래처 전환"(ConvertLeadButton)으로만 도달한다.
// UI/UX 리디자인: window.prompt(실패 사유·재접촉일) → 모달 입력.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionLead } from "@/server/actions/leads";
import { leadStatusLabels, LEAD_TRANSITIONS, type LeadStatus } from "@/domain/sales/lead-stages";
import { Modal } from "@/components/ui/Modal";

/** 전이 대상별 강조 — 파괴적(LOST)만 붉게, 나머지는 차분한 아웃라인. */
function buttonCls(to: LeadStatus, compact: boolean) {
  const base = `rounded-lg border font-medium disabled:opacity-50 ${
    compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
  }`;
  if (to === "LOST") return `${base} border-line bg-card text-slate-500 hover:border-rose-300 hover:text-rose-600`;
  return `${base} border-line bg-card text-slate-600 hover:border-emerald-300 hover:text-emerald-700`;
}

export function LeadStatusButtons({ leadId, status, compact = false }: { leadId: string; status: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"LOST" | "RECONTACT" | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [recontactDate, setRecontactDate] = useState("");

  const targets = (LEAD_TRANSITIONS[status as LeadStatus] ?? []).filter((t) => t !== "WON");
  if (targets.length === 0) return null;

  function submit(to: LeadStatus, extra: { lostReason?: string | null; nextActionAt?: string | null } = {}) {
    setError(null);
    start(async () => {
      const res = await transitionLead({
        id: leadId,
        to,
        lostReason: extra.lostReason ?? null,
        nextActionAt: extra.nextActionAt ?? null
      });
      if (!res.ok) setError(res.error);
      else {
        setDialog(null);
        router.refresh();
      }
    });
  }

  function onClickTarget(to: LeadStatus) {
    setError(null);
    if (to === "LOST") {
      setLostReason("");
      setDialog("LOST");
      return;
    }
    if (to === "RECONTACT") {
      setRecontactDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      setDialog("RECONTACT");
      return;
    }
    submit(to);
  }

  const inputCls =
    "mt-2 w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-sm text-ink placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none";
  const cancelBtn =
    "rounded-lg border border-line bg-card px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {targets.map((to) => (
        <button
          key={to}
          onClick={() => onClickTarget(to)}
          disabled={pending}
          className={buttonCls(to, compact)}
          aria-label={`${leadStatusLabels[to]}(으)로 이동`}
        >
          {leadStatusLabels[to]}
        </button>
      ))}
      {error && !dialog && <span className="text-[11px] text-rose-600">{error}</span>}

      <Modal
        open={dialog === "LOST"}
        onClose={() => setDialog(null)}
        title="계약실패 처리"
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={cancelBtn}>
              취소
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("LOST", { lostReason: lostReason.trim() || null })}
              className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {pending ? "처리 중…" : "실패로 이동"}
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-500">실패 사유는 재접촉 판단에 사용됩니다.</p>
        <input
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
          maxLength={500}
          placeholder="예: 예산 부족 / 타 업체 계약"
          className={inputCls}
          autoFocus
        />
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </Modal>

      <Modal
        open={dialog === "RECONTACT"}
        onClose={() => setDialog(null)}
        title="재접촉 예약"
        footer={
          <>
            <button type="button" onClick={() => setDialog(null)} className={cancelBtn}>
              취소
            </button>
            <button
              type="button"
              disabled={pending || !/^\d{4}-\d{2}-\d{2}$/.test(recontactDate)}
              onClick={() => submit("RECONTACT", { nextActionAt: recontactDate })}
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "처리 중…" : "예약"}
            </button>
          </>
        }
      >
        <p className="text-xs text-slate-500">예정일이 되면 담당자에게 재접촉 알림이 갑니다.</p>
        <input type="date" value={recontactDate} onChange={(e) => setRecontactDate(e.target.value)} className={inputCls} />
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </Modal>
    </div>
  );
}
