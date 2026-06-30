"use client";

import { useId, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type FormFieldProps = {
  label: string;
  /** field-level 오류 메시지(들). `ActionResult.error.fieldErrors[name]`를 그대로 넘길 수 있다. */
  errors?: string[];
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  /**
   * 컨트롤 렌더러. id/aria 속성을 자동 연결하려면 함수 형태로 받는다.
   * 단순 사용 시 children으로 직접 컨트롤을 넣어도 된다.
   */
  children: ReactNode | ((field: { id: string; invalid: boolean; describedBy?: string }) => ReactNode);
};

export function FormField({
  label,
  errors,
  hint,
  required,
  htmlFor,
  className,
  children
}: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const invalid = Boolean(errors && errors.length > 0);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = invalid ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>

      {typeof children === "function" ? children({ id, invalid, describedBy }) : children}

      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}

      {invalid ? (
        <ul id={errorId} className="space-y-0.5 text-xs text-danger">
          {errors!.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
