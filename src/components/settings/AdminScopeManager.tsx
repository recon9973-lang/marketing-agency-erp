// 목표 경로: src/components/settings/AdminScopeManager.tsx
//
// 관리자 접근 범위 편집 — 관리자별로 "담당자 전체/특정 · 거래처 전체/특정" 권한을 추가·삭제.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, X } from "lucide-react";
import { addAccessScope, removeAccessScope } from "@/server/actions/scopes";

type Pick = { id: string; name: string };
type Scope = {
  id: string;
  adminId: string;
  marketerId: string | null;
  marketerName: string | null;
  clientId: string | null;
  clientName: string | null;
  allMarketers: boolean;
  allClients: boolean;
};
type Kind = "ALL_MARKETERS" | "MARKETER" | "ALL_CLIENTS" | "CLIENT";

const sel = "rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-brand";

function scopeLabel(s: Scope): string {
  if (s.allMarketers) return "담당자 전체";
  if (s.marketerName) return `담당자 · ${s.marketerName}`;
  if (s.allClients) return "거래처 전체";
  if (s.clientName) return `거래처 · ${s.clientName}`;
  return "범위";
}

export function AdminScopeManager({
  admins,
  marketers,
  clients,
  scopes
}: {
  admins: Pick[];
  marketers: Pick[];
  clients: Pick[];
  scopes: Scope[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // 관리자별 "추가" 폼 상태.
  const [draft, setDraft] = useState<Record<string, { kind: Kind; targetId: string }>>({});

  function draftOf(adminId: string) {
    return draft[adminId] ?? { kind: "ALL_CLIENTS" as Kind, targetId: "" };
  }
  function setDraftFor(adminId: string, patch: Partial<{ kind: Kind; targetId: string }>) {
    setDraft((m) => ({ ...m, [adminId]: { ...draftOf(adminId), ...patch } }));
  }

  function add(adminId: string) {
    const d = draftOf(adminId);
    const needsTarget = d.kind === "MARKETER" || d.kind === "CLIENT";
    if (needsTarget && !d.targetId) {
      setError("대상을 선택해 주세요.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await addAccessScope({ adminId, kind: d.kind, targetId: needsTarget ? d.targetId : undefined });
      if (!res.ok) {
        setError("추가에 실패했습니다. 대상을 확인해 주세요.");
        return;
      }
      setDraftFor(adminId, { targetId: "" });
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    start(async () => {
      const res = await removeAccessScope({ id });
      if (!res.ok) {
        setError("삭제에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  if (admins.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-white p-4 text-sm text-slate-500">
        관리자(ADMIN) 역할 직원이 없습니다. 아래 <b>직원 초대·권한</b>에서 역할을 <b>관리자</b>로 지정하면 접근 범위를 정할 수 있습니다.
        <br />
        <span className="text-slate-400">※ 최고관리자는 항상 전체 접근이라 범위 설정이 필요 없고, 담당자는 본인 거래처만 봅니다.</span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {admins.map((admin) => {
        const rows = scopes.filter((s) => s.adminId === admin.id);
        const d = draftOf(admin.id);
        const needsTarget = d.kind === "MARKETER" || d.kind === "CLIENT";
        return (
          <div key={admin.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-strong"><ShieldCheck className="h-4 w-4" /></span>
              <p className="text-sm font-bold text-ink">{admin.name}</p>
              <span className="text-xs text-slate-400">관리자</span>
            </div>

            {/* 현재 범위 */}
            <div className="mt-3 flex flex-wrap gap-2">
              {rows.length === 0 ? (
                <span className="text-xs text-slate-400">아직 접근 범위가 없습니다 — 현재 이 관리자는 거래처를 볼 수 없습니다.</span>
              ) : (
                rows.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink">
                    {scopeLabel(s)}
                    <button type="button" onClick={() => remove(s.id)} disabled={pending} className="text-slate-400 hover:text-danger disabled:opacity-50" aria-label="삭제">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* 범위 추가 */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <select value={d.kind} onChange={(e) => setDraftFor(admin.id, { kind: e.target.value as Kind, targetId: "" })} className={sel}>
                <option value="ALL_CLIENTS">거래처 전체</option>
                <option value="CLIENT">특정 거래처</option>
                <option value="ALL_MARKETERS">담당자 전체</option>
                <option value="MARKETER">특정 담당자</option>
              </select>
              {needsTarget ? (
                <select value={d.targetId} onChange={(e) => setDraftFor(admin.id, { targetId: e.target.value })} className={sel}>
                  <option value="">{d.kind === "CLIENT" ? "거래처 선택" : "담당자 선택"}</option>
                  {(d.kind === "CLIENT" ? clients : marketers).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              ) : null}
              <button type="button" onClick={() => add(admin.id)} disabled={pending} className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                <Plus className="h-4 w-4" /> 추가
              </button>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] leading-relaxed text-slate-400">
        · <b>거래처/담당자 전체</b>: 이 관리자가 모든 거래처(또는 모든 담당자의 거래처)를 봅니다. · <b>특정</b>: 고른 거래처/담당자만.
      </p>
    </div>
  );
}
