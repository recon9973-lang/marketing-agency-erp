// 목표 경로: src/components/auth/SignupRequestForm.tsx
//
// 로그인 화면의 "직원 가입 요청" — 이메일/이름 제출 → PENDING 등록 → 관리자 승인 대기.
"use client";

import { useState, useTransition } from "react";
import { requestSignup } from "@/server/actions/signup";

const inputCls =
  "h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 text-sm text-white placeholder-white/30 outline-none focus:border-brand focus:ring-2 focus:ring-brand/25";

export function SignupRequestForm() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("이름과 이메일을 입력해 주세요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상으로 설정해 주세요.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    start(async () => {
      const res = await requestSignup({ email, name, password });
      if (!res.ok) {
        setError("요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="mt-6 border-t border-white/10 pt-5">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-200">
          가입 요청이 접수되었습니다. <b>관리자 승인</b> 후 <b>가입 시 설정한 이메일·비밀번호</b>로 로그인할 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-white/10 pt-5">
      {open ? (
        <div className="space-y-2">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-white/35">직원 가입 요청</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className={inputCls} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="이메일" className={inputCls} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="비밀번호 (8자 이상)" className={inputCls} />
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" placeholder="비밀번호 확인" className={inputCls} />
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button type="button" onClick={submit} disabled={pending} className="h-11 w-full rounded-lg bg-brand text-sm font-bold text-white disabled:opacity-50">
            {pending ? "요청 중…" : "가입 요청 보내기"}
          </button>
          <p className="text-[11px] leading-5 text-white/30">관리자 승인 후 이 이메일·비밀번호로 로그인할 수 있습니다.</p>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-[12px] text-white/45 transition hover:text-white/70">
          계정이 없으신가요? <span className="font-semibold text-brand">직원 가입 요청 →</span>
        </button>
      )}
    </div>
  );
}
