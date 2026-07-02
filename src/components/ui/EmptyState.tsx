import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-white px-6 py-12 text-center",
        className
      )}
    >
      {icon ? <div className="mb-3 text-slate-400">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
