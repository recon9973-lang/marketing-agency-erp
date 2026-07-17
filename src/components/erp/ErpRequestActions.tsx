"use client";
// src/components/erp/ErpRequestActions.tsx
// 요청 상세에서 상태 변경 + 답변 + 담당자 지정 패널

import { useState, useTransition } from "react";
import { updatePortalRequest } from "@/server/actions/erp-portal";
import { useRouter } from "next/navigation";

type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "OPEN", label: "접수" },
  { value: "IN_PROGRESS", label: "처리 중" },
  { value: "RESOLVED", label: "해결됨" },
  { value: "CLOSED", label: "종료" },
];

export function ErpRequestActions({
  requestId,
  currentStatus,
  currentAdminNote,
  currentAssigneeId,
  marketers,
  canAssign,
}: {
  requestId: string;
  currentStatus: string;
  currentAdminNote: string;
  currentAssigneeId: string | null;
  marketers: { id: string; name: string; role: string }[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(currentStatus as Status);
  const [adminNote, setAdminNote] = useState(currentAdminNote);
  const [assigneeId, setAssigneeId] = useState<string>(currentAssigneeId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updatePortalRequest({
        requestId,
        status,
        adminNote,
        assigneeId: assigneeId || null,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error ?? "저장에 실패했습니다.");
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
      <h2 className="text-sm font-bold text-slate-700">요청 처리</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 상태 변경 */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            처리 상태
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors
                  ${
                    status === opt.value
                      ? "border-sky-400 bg-sky-50 text-sky-700"
                      : "border-slate-100 text-slate-500 hover:border-slate-200"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 담당자 지정 (관리자만) */}
        {canAssign && marketers.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              담당자 지정
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <option value="">담당자 없음</option>
              {marketers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role === "ADMIN" ? "관리자" : "마케터"})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 공식 답변 */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">
          공식 답변 (거래처 포털에 표시됩니다)
        </label>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="거래처가 볼 공식 답변을 입력하세요. 댓글과 달리 요청 상단에 강조 표시됩니다."
          rows={4}
          className="w-full resize-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-700 placeholder-slate-300"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50
            text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {isPending ? "저장 중…" : "저장"}
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">✅ 저장됐습니다</span>
        )}
      </div>
    </div>
  );
}
