"use client";

// GEO 11단계 상단 탭바 — 단일 /geo 페이지의 파이프라인 네비게이션.
// 거래처(client)를 유지한 채 ?tab= 으로 단계 전환. 가로 스크롤(모바일 대응).
import Link from "next/link";
import type { Route } from "next";
import { GEO_STAGES, type GeoStageKey } from "@/domain/geo/stages";

export function GeoStageNav({ clientId, active }: { clientId: string | null; active: GeoStageKey }) {
  const base = clientId ? `/geo?client=${clientId}` : "/geo";
  return (
    <nav className="-mx-1 overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-1 px-1">
        {GEO_STAGES.map((s) => {
          const on = s.key === active;
          return (
            <li key={s.key}>
              <Link
                href={`${base}${clientId ? "&" : "?"}tab=${s.key}` as Route}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  on
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-line bg-card text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    on ? "bg-white/25 text-white" : "bg-surface text-slate-500"
                  }`}
                >
                  {s.step}
                </span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
