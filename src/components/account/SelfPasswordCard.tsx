"use client";

// 본인 계정 비밀번호 변경/설정 — 모든 역할(담당자 포함). 설정하면 이메일+비밀번호로 직접 로그인.
import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { changeOwnPassword } from "@/server/actions/account";

const inputCls =
  "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand";

const MSG: Record<string, string> = {
  WRONG_CURRENT: "현재 비밀번호가 올바르지 않습니다.",
  MISMATCH: "새 비밀번호가 일치하지 않습니다.",
  TOO_SHORT: "새 비밀번호는 8자 이상이어야 합니다.",
  SAVE_UNVERIFIED: "저장 후 검증에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  VALIDATION: "입력값을 확인해 주세요.",
  default: "변경에 실패했습니다. 잠시 후 다시 시도해 주세요."
};

// hasPassword: 이미 비밀번호가 설정돼 있으면 현재 비밀번호 확인 필요, 없으면 최초 설정.
export function SelfPasswordCard({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    setDone(false);
    if (next.trim().length < 8) return setError(MSG.TOO_SHORT);
    if (next !== confirm) return setError(MSG.MISMATCH);
    start(async () => {
      const res = await changeOwnPassword({ current: current || undefined, next, confirm });
      if (!res.ok) {
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
          <p className="text-sm font-bold text-ink">내 로그인 비밀번호</p>
          <p className="text-xs text-slate-500">
            {hasPassword
              ? `${email} — 이메일+비밀번호로 로그인합니다. 여기서 변경하세요.`
              : `${email} — 비밀번호를 설정하면 매직링크 없이 이메일+비밀번호로 로그인할 수 있습니다.`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid max-w-md gap-3">
        {hasPassword && (
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">현재 비밀번호</span>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </label>
        )}
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">{hasPassword ? "새 비밀번호 (8자 이상)" : "비밀번호 (8자 이상)"}</span>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">비밀번호 확인</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </label>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {done ? <p className="text-sm font-medium text-brand-strong">비밀번호가 설정되었습니다. 다음 로그인부터 사용하세요.</p> : null}

        <div>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !next || !confirm || (hasPassword && !current)}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "저장 중…" : hasPassword ? "비밀번호 변경" : "비밀번호 설정"}
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-400">
          특수문자(<code className="rounded bg-surface px-1">\ ₩ &apos; &quot;</code>) 없이 <b>영문+숫자 8자 이상</b>을 권장합니다. 맥·데스크탑 어디서나 같은 비밀번호로 로그인됩니다.
        </p>
      </div>
    </div>
  );
}
