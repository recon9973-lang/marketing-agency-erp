"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

const fieldCls =
  "h-12 w-full rounded-lg border border-white/10 bg-white/[0.03] pl-11 pr-4 text-sm text-white placeholder-white/30 outline-none transition focus:border-brand focus:bg-white/[0.05] focus:ring-2 focus:ring-brand/25";

/** 제출 중 로딩 오버레이 (form 내부 useFormStatus). */
function SubmittingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[#0c0b0f]/80 backdrop-blur-sm">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand" />
        <div className="absolute inset-[7px] animate-pulse rounded-full bg-brand/20" />
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/60">인증 중…</p>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-brand text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(217,102,46,0.8)] transition hover:bg-brand-strong disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> 로그인 중…
        </>
      ) : (
        <>
          로그인 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}

export function AdminLoginForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="relative mt-7 space-y-4">
      <SubmittingOverlay />

      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-white/45">Email</span>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input name="email" type="email" required autoComplete="username" placeholder="you@company.com" className={fieldCls} />
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-white/45">Password</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={`${fieldCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
            title={show ? "숨기기" : "보기"}
            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-white/40 transition hover:bg-white/10 hover:text-white/80"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>

      <div className="pt-1">
        <SubmitButton />
      </div>
    </form>
  );
}
