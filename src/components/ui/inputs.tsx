// V2 §1 공통 UI — 입력 컴포넌트 (Input, Textarea, Select, NumberInput, DateInput)
// 기존 화면의 `mt-1 w-full rounded border px-3 py-2` 스타일을 기준으로 공통화.
import type { ComponentProps, ReactNode } from "react";

const fieldBase =
  "w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#533afd] focus:border-[#533afd] disabled:bg-surface disabled:opacity-70";

// aria-invalid 시 위험색 테두리
const invalid = "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${fieldBase} ${invalid} ${className}`} {...props} />;
}

export function NumberInput({ className = "", ...props }: ComponentProps<"input">) {
  return <input type="number" className={`${fieldBase} ${invalid} ${className}`} {...props} />;
}

export function DateInput({ className = "", ...props }: ComponentProps<"input">) {
  return <input type="date" className={`${fieldBase} ${invalid} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${fieldBase} ${invalid} ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { children?: ReactNode }) {
  return (
    <select className={`${fieldBase} ${invalid} ${className}`} {...props}>
      {children}
    </select>
  );
}
