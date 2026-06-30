import type { ReactNode } from "react";
import type { BadgeTone, StatusDisplay } from "@/domain/status";
import { cx } from "@/components/ui/cx";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface text-slate-600 border-line",
  info: "bg-brand/10 text-brand border-brand/20",
  progress: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-warning border-amber-200",
  danger: "bg-red-50 text-danger border-red-200"
};

export type StatusBadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ tone = "neutral", children, className }: StatusBadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** 도메인 `StatusDisplay`(label + tone)를 그대로 렌더한다. */
export function StatusDisplayBadge({ display, className }: { display: StatusDisplay; className?: string }) {
  return (
    <StatusBadge tone={display.tone} className={className}>
      {display.label}
    </StatusBadge>
  );
}
