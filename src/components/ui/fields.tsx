import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const baseFieldClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30";

const invalidFieldClass = "border-danger focus:ring-danger/30";

export function fieldClass(options?: { invalid?: boolean; className?: string }) {
  return [baseFieldClass, options?.invalid ? invalidFieldClass : undefined, options?.className]
    .filter(Boolean)
    .join(" ");
}

type FieldModifiers = { invalid?: boolean };

export function Input({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldModifiers) {
  return <input aria-invalid={invalid || undefined} className={fieldClass({ invalid, className })} {...props} />;
}

export function DateInput({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldModifiers) {
  return (
    <input
      type="date"
      aria-invalid={invalid || undefined}
      className={fieldClass({ invalid, className })}
      {...props}
    />
  );
}

export function NumberInput({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldModifiers) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-invalid={invalid || undefined}
      className={fieldClass({ invalid, className })}
      {...props}
    />
  );
}

export function Select({
  invalid,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldModifiers) {
  return <select aria-invalid={invalid || undefined} className={fieldClass({ invalid, className })} {...props} />;
}

export function Textarea({
  invalid,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldModifiers) {
  return (
    <textarea aria-invalid={invalid || undefined} className={fieldClass({ invalid, className })} rows={props.rows ?? 4} {...props} />
  );
}
