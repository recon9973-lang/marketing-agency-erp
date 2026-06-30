import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type FilterBarProps = {
  children: ReactNode;
  /** 오른쪽 끝에 배치할 액션(검색 버튼, 초기화 등). */
  actions?: ReactNode;
  className?: string;
};

/**
 * 목록 화면 상단의 필터 컨트롤을 일관된 간격/정렬로 배치하는 컨테이너.
 * 내부에는 `FilterField`나 임의의 컨트롤을 넣는다.
 */
export function FilterBar({ children, actions, className }: FilterBarProps) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3 rounded-md border border-line bg-white p-4 md:flex-row md:flex-wrap md:items-end",
        className
      )}
    >
      <div className="flex flex-1 flex-col gap-3 md:flex-row md:flex-wrap md:items-end">{children}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export type FilterFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

/** FilterBar 내부에서 라벨 + 컨트롤을 묶는 작은 필드 래퍼. */
export function FilterField({ label, children, className }: FilterFieldProps) {
  return (
    <label className={cx("flex flex-col gap-1 text-xs font-medium text-slate-500", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}
