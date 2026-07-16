// 목표 경로: src/components/settings/FeaturePermissions.tsx
//
// 기능(메뉴) 단위 접근 권한 — 직원별로 재무·계약서·영업리드·근태 접근을 켜고/끈다.
// 체크 = 허용. 해제하면 그 직원에게 해당 메뉴가 숨겨지고 접근이 차단된다.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CONTROLLABLE_FEATURES, type FeatureKey } from "@/domain/features";
import { setUserFeatureAccess } from "@/server/actions/employees";

type Member = { id: string; name: string; role: string; deniedFeatures: FeatureKey[] };

const ROLE_LABEL: Record<string, string> = { ADMIN: "관리자", MARKETER: "담당자" };

export function FeaturePermissions({ members }: { members: Member[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState<Record<string, FeatureKey[]>>(() =>
    Object.fromEntries(members.map((m) => [m.id, m.deniedFeatures]))
  );

  function toggle(userId: string, key: FeatureKey, allow: boolean) {
    const cur = denied[userId] ?? [];
    const nextDenied = allow ? cur.filter((k) => k !== key) : Array.from(new Set([...cur, key]));
    setDenied((d) => ({ ...d, [userId]: nextDenied }));
    setError(null);
    start(async () => {
      const res = await setUserFeatureAccess({ userId, deniedFeatures: nextDenied });
      if (!res.ok) {
        setError("권한 변경에 실패했습니다.");
        setDenied((d) => ({ ...d, [userId]: cur }));
        return;
      }
      router.refresh();
    });
  }

  if (members.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-4 text-sm text-slate-500">권한을 조정할 직원(관리자/담당자)이 없습니다.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-semibold">직원</th>
              {CONTROLLABLE_FEATURES.map((f) => (
                <th key={f.key} className="px-3 py-2.5 text-center font-semibold">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <span className="font-medium text-ink">{m.name}</span>
                  <span className="ml-1.5 text-xs text-slate-400">{ROLE_LABEL[m.role] ?? m.role}</span>
                </td>
                {CONTROLLABLE_FEATURES.map((f) => {
                  const allowed = !(denied[m.id] ?? []).includes(f.key);
                  return (
                    <td key={f.key} className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allowed}
                        disabled={pending}
                        onChange={(e) => toggle(m.id, f.key, e.target.checked)}
                        className="h-4 w-4 accent-brand disabled:opacity-50"
                        aria-label={`${m.name} · ${f.label} 접근`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="text-[11px] leading-relaxed text-slate-400">
        체크 = 접근 허용. 해제하면 해당 메뉴가 그 직원에게 <b>숨겨지고 접근이 차단</b>됩니다. 최고관리자는 항상 전체 접근입니다. (변경은 최대 30초 내 반영)
      </p>
    </div>
  );
}
