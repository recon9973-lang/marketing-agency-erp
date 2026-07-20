"use client";

// 직원 로그인 접근 관리 — 직원별 로그인 링크(매직링크) 발급·복사.
// 직원은 비밀번호가 아니라 이 링크로 로그인한다. 로그인 안 되는 직원에게 링크를 보내면 즉시 접속 가능.
import { useState } from "react";
import { getOrCreateLoginLink } from "@/server/actions/employees";

type Staff = { id: string; name: string; email: string; role: string; status: string };

const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: "최고관리자", ADMIN: "관리자", MARKETER: "담당자" };
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "활성", cls: "text-emerald-600" },
  INVITED: { label: "초대됨", cls: "text-sky-600" },
  PENDING: { label: "승인대기", cls: "text-amber-600" },
  SUSPENDED: { label: "정지", cls: "text-rose-500" }
};

export function StaffAccessTool({ staff }: { staff: Staff[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copyLink(userId: string) {
    setBusyId(userId);
    setError(null);
    const res = await getOrCreateLoginLink({ userId });
    setBusyId(null);
    if (!res.ok || !res.data) {
      setError("로그인 링크 생성에 실패했습니다.");
      return;
    }
    const url = `${window.location.origin}/invite/${res.data.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(userId);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      window.prompt("아래 로그인 링크를 복사해 직원에게 전달하세요:", url);
    }
  }

  if (staff.length === 0) {
    return <p className="text-sm text-slate-400">등록된 직원이 없습니다.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-3 font-semibold">직원</th>
              <th className="px-2 py-2 font-semibold">역할</th>
              <th className="px-2 py-2 font-semibold">상태</th>
              <th className="py-2 pl-2 text-right font-semibold">로그인 링크</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const st = STATUS_LABEL[s.status] ?? { label: s.status, cls: "text-slate-500" };
              return (
                <tr key={s.id} className="border-b border-line/60">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-ink">{s.name}</p>
                    <p className="text-[11px] text-slate-400">{s.email}</p>
                  </td>
                  <td className="px-2 py-2 text-slate-600">{ROLE_LABEL[s.role] ?? s.role}</td>
                  <td className={`px-2 py-2 font-medium ${st.cls}`}>{st.label}</td>
                  <td className="py-2 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => copyLink(s.id)}
                      disabled={busyId === s.id}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-strong hover:bg-surface disabled:opacity-50"
                    >
                      {busyId === s.id ? "생성 중…" : copiedId === s.id ? "복사됨 ✓" : "링크 복사"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">
        직원은 비밀번호가 아니라 <b>로그인 링크</b>로 접속합니다. 링크를 복사해 카카오톡·문자로 전달하면 직원이 클릭만으로 로그인됩니다(비밀번호 불필요).
      </p>
    </div>
  );
}
