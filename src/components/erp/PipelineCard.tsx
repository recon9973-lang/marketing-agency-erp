"use client";
// src/components/erp/PipelineCard.tsx
// 파이프라인 Kanban 카드 — 클라이언트 컴포넌트 (상태 변경 드롭다운 포함)

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateClientPipelineStatus } from "@/server/actions/erp-portal";
import { useRouter } from "next/navigation";

type Client = {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  contractStartDate: string | null;
  monthlyContractFee: number | null;
  updatedAt: string;
  assignedMarketer: { name: string } | null;
  stageAssignee: { name: string } | null;
  openRequestCount: number;
  portalUserCount: number;
};

export function PipelineCard({
  client,
  stages,
}: {
  client: Client;
  stages: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showMove, setShowMove] = useState(false);

  function moveToStage(newStatus: string) {
    setShowMove(false);
    startTransition(async () => {
      await updateClientPipelineStatus({
        clientId: client.id,
        status: newStatus,
      });
      router.refresh();
    });
  }

  return (
    <div
      className={`bg-white rounded-xl border border-slate-100 p-3.5 space-y-2.5
        hover:shadow-sm transition-shadow relative ${isPending ? "opacity-60" : ""}`}
    >
      {/* 이름 + 코드 */}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/clients/${client.id}`}
          className="text-sm font-bold text-slate-800 hover:text-sky-600 leading-tight"
        >
          {client.name}
        </Link>
        <span className="text-xs text-slate-300 shrink-0 font-mono">
          {client.code}
        </span>
      </div>

      {/* 메타 정보 */}
      <div className="space-y-1 text-xs text-slate-500">
        {client.contactName && <p>👤 {client.contactName}</p>}
        {client.assignedMarketer && (
          <p>담당: {client.assignedMarketer.name}</p>
        )}
        {client.monthlyContractFee != null && (
          <p className="font-medium text-slate-700">
            ₩{client.monthlyContractFee.toLocaleString("ko-KR")}
          </p>
        )}
      </div>

      {/* 뱃지 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {client.openRequestCount > 0 && (
          <Link
            href={`/portal-requests?clientId=${client.id}`}
            className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full hover:bg-amber-100"
          >
            미처리 {client.openRequestCount}건
          </Link>
        )}
        {client.portalUserCount > 0 && (
          <span className="text-xs px-2 py-0.5 bg-sky-50 text-sky-600 border border-sky-100 rounded-full">
            포털 {client.portalUserCount}명
          </span>
        )}
      </div>

      {/* 단계 이동 버튼 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMove((v) => !v)}
          disabled={isPending}
          className="w-full text-xs py-1.5 border border-slate-100 rounded-lg text-slate-400
            hover:border-sky-200 hover:text-sky-500 transition-colors text-center"
        >
          단계 변경 ▾
        </button>

        {showMove && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
            {stages.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => moveToStage(s.value)}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
