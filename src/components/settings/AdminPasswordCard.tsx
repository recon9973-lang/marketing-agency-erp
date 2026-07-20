// 목표 경로: src/components/settings/AdminPasswordCard.tsx
//
// ERP 로그인 비밀번호 변경 카드 — 최고관리자 전용. 현재/새/확인 입력 후 변경.
"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { changeAdminPassword } from "@/server/actions/account";

const inputCls =
  "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

const MSG: Record<string, string> = {
  WRONG_CURRENT: "현재 비밀번호가 올바르지 않습니다.",
  MISMATCH: "새 비밀번호가 일치하지 않습니다.",
  TOO_SHORT: "새 비밀번호는 8자 이상이어야 합니다.",
  FORBIDDEN: "변경 권한이 없습니다.",
  NO_ADMIN_EMAIL: "관리자 이메일(ADMIN_EMAIL)이 설정되어 있지 않습니다.",
  VALIDATION: "입력값을 확인해 주세요.",
  default: "변경에 실패했습니다. 잠시 후 다시 시도해 주세요."
};

export function AdminPasswordCard({ adminEmail }: { adminEmail: string | null }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    setDone(false);
    if (next.trim().length < 8) {
      setError(MSG.TOO_SHORT);
      return;
    }
    if (next !== confirm) {
      setError(MSG.MISMATCH);
      return;
    }
    start(async () => {
      const res = await changeAdminPassword({ current, next, confirm });
      if (!res.ok) {
        // 서버가 코드별로 이미 한국어 메시지를 만들어 준다 → 그대로 노출(원인 정확히 표시).
        setError(res.error || MSG[res.code ?? "default"] || MSG.default);
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
          <KeyRound className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">로그인 비밀번호</p>
          <p className="text-xs text-slate-500">{adminEmail ? `${adminEmail} 계정의 로그인 비밀번호를 변경합니다.` : "관리자 로그인 비밀번호를 변경합니다."}</p>
        </div>
      </div>

      <div className="mt-4 grid max-w-md gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">현재 비밀번호</span>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">새 비밀번호 (8자 이상)</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">새 비밀번호 확인</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </label>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {done ? <p className="text-sm font-medium text-brand-strong">비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.</p> : null}

        <div>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !current || !next || !confirm}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "변경 중…" : "비밀번호 변경"}
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-400">
          변경 후에는 새 비밀번호로 로그인합니다. 비밀번호를 잊었을 때를 대비한 복구용 마스터 비밀번호(Vercel의 ADMIN_PASSWORD)는 계속 유효합니다.
        </p>
      </div>
    </div>
  );
}
