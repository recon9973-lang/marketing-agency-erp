// 목표 경로: src/components/leads/ConvertLeadButton.tsx
//
// 계약 성사 → 거래처 전환 버튼. 비가역(Client 생성)이므로 확인 모달 필수(패널 결정 #10).
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { convertLeadToClient } from "@/server/actions/leads";

export function ConvertLeadButton({ leadId, hospitalName, disabled }: { leadId: string; hospitalName: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!window.confirm(`"${hospitalName}"을(를) 거래처로 전환합니다.\n거래처·병원프로필이 생성되고 리드는 계약성공으로 종결됩니다. 진행할까요?`)) {
      return;
    }
    setError(null);
    start(async () => {
      const res = await convertLeadToClient({ id: leadId });
      if (!res.ok) setError(res.error);
      else if (res.data) router.push(`/clients/${res.data.clientId}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={pending || disabled}
        className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? "전환 중…" : "계약 성사 — 거래처로 전환"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
