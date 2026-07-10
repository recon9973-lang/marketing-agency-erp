// 목표 경로: src/components/approvals/ApprovalQueue.tsx
//
// 통합 승인 큐 — 대기 승인(관리자 승인/반려) + 내 요청 목록.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { decideApproval } from "@/server/actions/approvals";

type Approval = {
  id: string;
  targetType: string;
  title: string;
  clientName: string | null;
  requesterName: string;
  approverName: string | null;
  status: string;
  comment: string | null;
  createdAt: string;
  decidedAt: string | null;
};

const TYPE_LABEL: Record<string, string> = { CONTRACT: "계약", QUOTE: "견적", CONTENT: "콘텐츠", COMPLIANCE: "컴플라이언스" };
const STATUS_LABEL: Record<string, string> = { PENDING: "대기", APPROVED: "승인", REJECTED: "반려" };
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" });

function TypeChip({ t }: { t: string }) {
  return <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-strong">{TYPE_LABEL[t] ?? t}</span>;
}
function StatusChip({ s }: { s: string }) {
  const cls = s === "APPROVED" ? "bg-emerald-50 text-emerald-600" : s === "REJECTED" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{STATUS_LABEL[s] ?? s}</span>;
}

export function ApprovalQueue({ pending, myRequests, canDecide }: { pending: Approval[]; myRequests: Approval[]; canDecide: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [comments, setComments] = useState<Record<string, string>>({});

  function decide(id: string, status: "APPROVED" | "REJECTED") {
    start(async () => {
      const res = await decideApproval({ id, status, comment: comments[id] || null });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {canDecide ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-ink">승인 대기 ({pending.length})</h3>
          {pending.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-6 text-center text-sm text-slate-500">대기 중인 승인이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((a) => (
                <li key={a.id} className="rounded-xl border border-line bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeChip t={a.targetType} />
                    <span className="text-sm font-semibold text-ink">{a.title}</span>
                    {a.clientName ? <span className="text-xs text-slate-400">· {a.clientName}</span> : null}
                    <span className="ml-auto text-xs text-slate-400">{a.requesterName} · {dateFmt.format(new Date(a.createdAt))}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input value={comments[a.id] ?? ""} onChange={(e) => setComments({ ...comments, [a.id]: e.target.value })} placeholder="의견(선택)" className="min-w-0 flex-1 rounded-md border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand" />
                    <button type="button" onClick={() => decide(a.id, "APPROVED")} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /> 승인</button>
                    <button type="button" onClick={() => decide(a.id, "REJECTED")} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-danger px-3 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-50"><X className="h-3.5 w-3.5" /> 반려</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-ink">내 승인 요청 ({myRequests.length})</h3>
        {myRequests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-6 text-center text-sm text-slate-500">요청한 승인이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {myRequests.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3">
                <TypeChip t={a.targetType} />
                <span className="text-sm font-semibold text-ink">{a.title}</span>
                {a.clientName ? <span className="text-xs text-slate-400">· {a.clientName}</span> : null}
                <span className="ml-auto"><StatusChip s={a.status} /></span>
                {a.status !== "PENDING" && a.approverName ? <span className="text-xs text-slate-400">{a.approverName}{a.comment ? ` · ${a.comment}` : ""}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
