// 목표 경로: src/components/geo/GeoChannelGuide.tsx
//
// AI 채널 전략 가이드(접이식) — 채널×엔진 인용 가능성 + 자동화 레벨 + 병원 적합도.
// 도메인 데이터(geo-channels.ts, 첨부 전략 보고서 기반)를 참조용으로 표시한다.
// 데스크톱 테이블은 overflow 래퍼, 모바일은 카드 리스트(잘림 방지).
"use client";

import { useState } from "react";
import { GEO_CHANNEL_PLAYBOOK, automationLevelLabels } from "@/domain/sales/geo-channels";

const ENGINE_COLS = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "gemini", label: "Gemini" },
  { key: "claude", label: "Claude" },
  { key: "perplexity", label: "Perplexity" }
] as const;

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`5점 만점에 ${n}점`} className={n >= 4 ? "text-amber-500" : "text-slate-400"}>
      {"★".repeat(n)}
      <span className="text-slate-200">{"★".repeat(5 - n)}</span>
    </span>
  );
}

const LEVEL_TONE: Record<string, string> = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-200",
  B: "bg-amber-50 text-amber-700 border-amber-200",
  C: "bg-blue-50 text-blue-700 border-blue-200",
  D: "bg-rose-50 text-rose-700 border-rose-200"
};

export function GeoChannelGuide({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-bold text-ink" aria-expanded={open}>
        {open ? "− AI 채널 전략 가이드 접기" : "+ AI 채널 전략 가이드 (채널×엔진 인용 가능성·자동화 레벨)"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-slate-500">
            첨부 전략 보고서 기준 — 언드 미디어(제3자 보도)는 자사 콘텐츠 대비 AI 인용률이 크게 높습니다.
            자동화 레벨: A 완전 자동화 · B 반자동(사람 최종 검토) · C AI 초안만 · D 인간 필수.
          </p>

          {/* 데스크톱 테이블 */}
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="border-b border-line bg-surface font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">채널</th>
                  {ENGINE_COLS.map((e) => (
                    <th key={e.key} className="px-2 py-2 text-center">{e.label}</th>
                  ))}
                  <th className="px-2 py-2 text-center">우선순위</th>
                  <th className="px-2 py-2 text-center">자동화</th>
                  <th className="px-2 py-2 text-center">병원 적합</th>
                  <th className="px-3 py-2">실무 노트</th>
                </tr>
              </thead>
              <tbody>
                {GEO_CHANNEL_PLAYBOOK.map((c) => (
                  <tr key={c.channel} className="border-t border-line align-top">
                    <td className="px-3 py-2 font-semibold text-ink">{c.channel}</td>
                    {ENGINE_COLS.map((e) => (
                      <td key={e.key} className="whitespace-nowrap px-2 py-2 text-center">
                        <Stars n={c.ratings[e.key]} />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-bold text-ink">{c.priority}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${LEVEL_TONE[c.automationLevel]}`}>
                        {c.automationLevel} {automationLevelLabels[c.automationLevel]}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center text-slate-600">{c.hospitalFit}</td>
                    <td className="px-3 py-2 text-slate-500">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <ul className="space-y-2 md:hidden">
            {GEO_CHANNEL_PLAYBOOK.map((c) => (
              <li key={c.channel} className="rounded-xl border border-line bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm text-ink">{c.channel}</b>
                  <span className="text-xs font-bold text-ink">{c.priority}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  {ENGINE_COLS.map((e) => (
                    <span key={e.key}>
                      {e.label} <Stars n={c.ratings[e.key]} />
                    </span>
                  ))}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${LEVEL_TONE[c.automationLevel]}`}>
                    {c.automationLevel} {automationLevelLabels[c.automationLevel]}
                  </span>
                  <span className="text-[11px] text-slate-500">병원 적합 {c.hospitalFit}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">{c.note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
