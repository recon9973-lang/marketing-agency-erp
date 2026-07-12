// 목표 경로: src/components/geo/GeoTabs.tsx
//
// GEO 화면 탭 — 6개 패널이 세로로 쌓이던 정보구조를 업무 단위 탭으로 재편(UI/UX 리디자인).
// 패널은 언마운트하지 않고 hidden 처리해 폼 입력 상태를 유지한다.
"use client";

import { useState, type ReactNode } from "react";

export type GeoTabDef = { key: string; label: string; badge?: number };

export function GeoTabs({
  tabs,
  defaultIndex = 0,
  children
}: {
  tabs: GeoTabDef[];
  defaultIndex?: number;
  children: ReactNode[];
}) {
  const [active, setActive] = useState(Math.min(defaultIndex, tabs.length - 1));

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="GEO 업무" className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-card p-1.5">
        {tabs.map((t, i) => {
          const selected = i === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`geo-panel-${t.key}`}
              id={`geo-tab-${t.key}`}
              onClick={() => setActive(i)}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                selected ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-surface hover:text-ink"
              }`}
            >
              {t.label}
              {typeof t.badge === "number" && t.badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    selected ? "bg-white/25 text-white" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((t, i) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`geo-panel-${t.key}`}
          aria-labelledby={`geo-tab-${t.key}`}
          hidden={i !== active}
          className="space-y-4"
        >
          {children[i]}
        </div>
      ))}
    </div>
  );
}
