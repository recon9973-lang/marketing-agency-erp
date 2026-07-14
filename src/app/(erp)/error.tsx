"use client";

// (erp) 인증 영역 공통 에러 바운더리 — 페이지 렌더/데이터 로드 중 예외가 나도
// 화면 전체가 흰 500으로 죽지 않고 복구 가능한 UI를 보여준다. digest는 로그 대조용.
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErpError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 서버 로그에 남도록(클라이언트 콘솔). 프로덕션에선 메시지가 가려질 수 있어 digest도 함께.
    console.error("[erp] route error", error?.message, error?.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-bold text-ink">화면을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          일시적인 문제일 수 있습니다. 다시 시도해 주세요. 계속되면 관리자에게 문의하세요.
        </p>
        {error?.digest ? (
          <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[11px] text-slate-400">오류 코드: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-strong"
        >
          <RotateCcw className="h-4 w-4" /> 다시 시도
        </button>
      </div>
    </div>
  );
}
