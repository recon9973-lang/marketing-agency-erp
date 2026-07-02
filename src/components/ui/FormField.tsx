import type { ReactNode } from "react";

export function FormField({
  label,
  required,
  hint,
  errors,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <label className="block text-sm text-slate-600">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </span>
      {children}
      {hint && (!errors || errors.length === 0) ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
      {errors?.map((error) => (
        <span key={error} className="mt-1 block text-xs text-danger">
          {error}
        </span>
      ))}
    </label>
  );
}
