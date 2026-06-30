import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** 오른쪽 액션 영역(버튼, 요약 카드 등). */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cx("flex flex-col gap-3 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        {eyebrow ? <p className="text-sm font-semibold text-brand">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
