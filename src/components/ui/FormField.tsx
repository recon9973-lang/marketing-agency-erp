// V2 §1 공통 UI — FormField
// label + (필수 표시) + 도움말 + field-level 오류 메시지 래퍼.
// action-result의 fieldErrors[name] 를 error 로 그대로 넘겨 쓸 수 있다.
import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string | string[];
  children: ReactNode;
}) {
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <div className="block space-y-1">
      <label htmlFor={htmlFor} className="text-sm text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {hint && errors.length === 0 && <p className="text-xs text-slate-400">{hint}</p>}
      {errors.map((message, i) => (
        <p key={i} className="text-xs text-danger">
          {message}
        </p>
      ))}
    </div>
  );
}
