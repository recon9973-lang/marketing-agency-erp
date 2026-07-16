// 목표 경로: src/components/settings/PendingApprovals.tsx
//
// 셀프 가입 요청(PENDING) 승인/거절 — 관리자 이상. 승인 시 역할 지정 + 로그인 링크 메일 발송.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, UserPlus, X } from "lucide-react";
import { approveSignup, rejectSignup } from "@/server/actions/signup";

type Req = { id: string; name: string; email: string; createdAt: string };

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" });

export function PendingApprovals({ requests }: { requests: Req[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});

  function approve(id: string) {
    const role = roles[id] ?? "MARKETER";
    setError(null);
    start(async () => {
      const res = await approveSignup({ userId: id, role });
      if (!res.ok) {
        setError("승인에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  function reject(id: string) {
    if (!confirm("이 가입 요청을 거절(삭제)할까요?")) return;
    setError(null);
    start(async () => {
      const res = await rejectSignup({ userId: id });
      if (!res.ok) {
        setError("거절에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-4 text-sm text-slate-400">대기 중인 가입 요청이 없습니다.</p>;
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {requests.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><UserPlus className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{r.name}</p>
            <p className="text-xs text-slate-500">{r.email} · {dateFmt.format(new Date(r.createdAt))}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <select value={roles[r.id] ?? "MARKETER"} onChange={(e) => setRoles((m) => ({ ...m, [r.id]: e.target.value }))} className="rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink">
              <option value="MARKETER">담당자</option>
              <option value="ADMIN">관리자</option>
            </select>
            <button type="button" onClick={() => approve(r.id)} disabled={pending} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              <Check className="h-3.5 w-3.5" /> 승인
            </button>
            <button type="button" onClick={() => reject(r.id)} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs text-slate-500 hover:text-danger disabled:opacity-50">
              <X className="h-3.5 w-3.5" /> 거절
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
