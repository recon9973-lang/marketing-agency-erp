// 목표 경로: src/components/settings/MarketerAssignment.tsx
//
// 담당자별 배정 현황 — 마케터별 담당 거래처를 한 화면에서 보고, 다른 담당자로 이동.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, UserRound } from "lucide-react";
import { reassignMarketer } from "@/server/actions/clients";

type Pick = { id: string; name: string };
type Client = { id: string; name: string; assignedMarketerId: string | null };

const sel = "rounded-md border border-line bg-white px-2 py-1 text-xs text-ink outline-none focus:border-brand";

export function MarketerAssignment({ marketers, clients }: { marketers: Pick[]; clients: Client[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  function move(clientId: string, newMarketerId: string) {
    if (!newMarketerId) return;
    setError(null);
    setMovingId(clientId);
    start(async () => {
      const res = await reassignMarketer({ clientId, newMarketerId });
      setMovingId(null);
      if (!res.ok) {
        setError("담당자 이동에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  if (marketers.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-4 text-sm text-slate-500">담당자(마케터) 역할 직원이 없습니다.</p>;
  }

  const unassigned = clients.filter((c) => !c.assignedMarketerId);

  function ClientRow({ c }: { c: Client }) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5">
        <span className="truncate text-sm text-ink">{c.name}</span>
        <select
          value={c.assignedMarketerId ?? ""}
          onChange={(e) => move(c.id, e.target.value)}
          disabled={pending && movingId === c.id}
          className={sel}
          aria-label="담당자 이동"
        >
          <option value="">{c.assignedMarketerId ? "이동…" : "담당자 지정…"}</option>
          {marketers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {marketers.map((m) => {
          const mine = clients.filter((c) => c.assignedMarketerId === m.id);
          return (
            <div key={m.id} className="rounded-2xl border border-line bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"><UserRound className="h-4 w-4" /></span>
                <p className="text-sm font-bold text-ink">{m.name}</p>
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400"><Briefcase className="h-3.5 w-3.5" />{mine.length}건</span>
              </div>
              <div className="mt-3 space-y-1.5">
                {mine.length === 0 ? (
                  <p className="text-xs text-slate-400">담당 거래처가 없습니다.</p>
                ) : (
                  mine.map((c) => <ClientRow key={c.id} c={c} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-4">
          <p className="text-sm font-bold text-ink">미배정 거래처 <span className="text-xs font-normal text-slate-400">{unassigned.length}건</span></p>
          <div className="mt-3 grid gap-1.5 md:grid-cols-2">
            {unassigned.map((c) => <ClientRow key={c.id} c={c} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
