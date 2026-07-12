// 목표 경로: src/components/geo/GeoAutoWatch.tsx
//
// GEO 자동 관측 패널 — 설정된 AI 엔진(공식 API)으로 승인 질문을 자동 실행·판정·기록.
// 매주 월요일 자동 실행(크론) + 여기서 즉시 실행 가능. 결과 기록에는 "자동 관측" 메모가 붙는다.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runGeoWatchNow } from "@/server/actions/geo";

const ENGINE_LABEL: Record<string, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
  CLAUDE: "Claude"
};

export function GeoAutoWatch({
  clientId,
  configuredEngines,
  monitorableCount
}: {
  clientId: string;
  configuredEngines: string[];
  monitorableCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const res = await runGeoWatchNow({ clientId });
      if (!res.ok) setMsg(res.error);
      else if (res.data) {
        setMsg(
          res.data.asked === 0
            ? "오늘은 이미 관측했거나 실행할 질문이 없습니다."
            : `관측 ${res.data.asked}건 완료 — 출현 ${res.data.appeared} · 인용 ${res.data.cited}${res.data.failed ? ` · 실패 ${res.data.failed}` : ""}`
        );
        router.refresh();
      }
    });
  }

  const ready = configuredEngines.length > 0 && monitorableCount > 0;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-base" aria-hidden="true">
          🤖
        </span>
        <p className="text-sm font-bold text-ink">자동 관측 (공식 API)</p>
        {["CHATGPT", "PERPLEXITY", "GEMINI", "CLAUDE"].map((e) => (
          <span
            key={e}
            className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
              configuredEngines.includes(e)
                ? "border-emerald-200 bg-card text-emerald-700"
                : "border-line bg-surface text-slate-400"
            }`}
          >
            {ENGINE_LABEL[e]} {configuredEngines.includes(e) ? "켜짐" : "키 없음"}
          </span>
        ))}
        <button
          type="button"
          onClick={run}
          disabled={pending || !ready}
          className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "관측 중… (1~2분)" : "지금 자동 관측 실행"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        승인된 질문 {monitorableCount}개를 켜진 엔진에 자동으로 질문하고, 병원 언급·공식 URL 인용을 판정해 매트릭스에 기록합니다.
        매주 월요일 자동 실행되며, 결과에는 “자동 관측” 메모와 답변 원문(증빙)이 남습니다.
        {configuredEngines.length === 0 &&
          " — 연동 화면에서 엔진 API 키(OPENAI_API_KEY·PERPLEXITY_API_KEY·GOOGLE_AI_API_KEY·ANTHROPIC_API_KEY)를 설정하면 켜집니다."}
      </p>
      {msg && <p className="mt-1.5 text-xs font-semibold text-emerald-700">{msg}</p>}
    </div>
  );
}
