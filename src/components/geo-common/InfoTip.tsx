"use client";

// 용어 설명 팝오버 — 애매한 지표/단축어 옆 ⓘ 버튼. 클릭하면 설명 박스가 뜬다.
// 서버 컴포넌트 화면에서도 쓰도록 클라이언트 컴포넌트로 분리.
import { useState, type ReactNode } from "react";

export function InfoTip({ label, children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-label={label ? `${label} 설명` : "설명 보기"}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold leading-none text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-600"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-5 z-30 w-60 rounded-lg border border-line bg-card p-2.5 text-left text-[11px] font-normal leading-relaxed text-slate-600 shadow-xl"
        >
          {label && <b className="mb-1 block text-ink">{label}</b>}
          {children}
        </span>
      )}
    </span>
  );
}
