import type { ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "warning" | "danger";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-line bg-surface text-slate-700",
  success: "border-brand/30 bg-brand/10 text-brand",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger"
};

export function statusBadgeClass(tone: StatusTone = "neutral", className?: string) {
  return [
    "inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold",
    toneClasses[tone],
    className
  ]
    .filter(Boolean)
    .join(" ");
}

export function StatusBadge({
  tone = "neutral",
  className,
  children
}: {
  tone?: StatusTone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={statusBadgeClass(tone, className)}>{children}</span>;
}
