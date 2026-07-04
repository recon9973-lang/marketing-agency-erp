// V2 §1 공통 UI — FilterBar
// 목록 화면 상단의 필터/검색 영역을 감싸는 공통 레이아웃 패턴.
import type { ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-line bg-white p-3">
      {children}
    </div>
  );
}

// 필터 항목 하나(라벨 + 컨트롤). FilterBar 안에서 사용.
export function FilterItem({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-slate-500">{label}</span>}
      {children}
    </div>
  );
}
