"use client";

// 로그인 링크 발송 폼 + 브랜드 로딩 오버레이.
// 서버 액션(sendMagicLink) 진행 중(useFormStatus.pending)에는 베놈 로고가
// 맥동하는 풀스크린 로딩 화면을 띄운다. 성공 시 next-auth가 "메일 확인"
// 페이지로 리다이렉트하므로, 그 사이 빈 화면을 이 오버레이가 덮어준다.

import { useFormStatus } from "react-dom";
import { BrandLogo } from "@/components/erp/BrandLogo";

/** 발송 중 풀스크린 브랜드 로딩 화면 */
function SendingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-surface/95 backdrop-blur-sm"
    >
      {/* 로고: 오렌지 액센트 도트에서 링이 퍼지는 이팩트 */}
      <BrandLogo tone="light" animateDot className="text-5xl" />

      <div className="text-center">
        <p className="text-sm font-semibold text-ink">로그인 링크를 보내는 중…</p>
        <p className="mt-1 text-xs text-slate-500">잠시만 기다려 주세요</p>
      </div>
    </div>
  );
}

/** 제출 버튼: 발송 중에는 비활성 + 스피너 문구 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          보내는 중…
        </>
      ) : (
        "로그인 링크 받기"
      )}
    </button>
  );
}

export function LoginForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <form action={action} className="mt-8 space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">직원 이메일</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="h-12 w-full rounded-md border border-line px-4 text-sm text-ink outline-none focus:border-brand"
        />
      </label>
      <SubmitButton />
      <p className="text-xs leading-5 text-slate-500">
        사전 등록된 직원 이메일만 로그인할 수 있습니다. 메일이 보이지 않으면 스팸함도 확인해 주세요.
      </p>
      <SendingOverlay />
    </form>
  );
}
