// 목표 경로: src/components/magazine/MagazineBatchButton.tsx
//
// 큐 상위 N건을 한 번에 AI 초안 생성(안전 램프업 — 기본 3개). 시간이 걸려 진행 표시.
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftMagazineBatch } from "@/server/actions/magazine";

export function MagazineBatchButton({ queued }: { queued: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const res = await draftMagazineBatch({ limit: 3 });
      if (!res.ok) setMsg(res.error);
      else if (res.data) {
        setMsg(`초안 ${res.data.drafted}개 생성${res.data.failed ? ` · 실패 ${res.data.failed}` : ""}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending || queued === 0}
        className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "생성 중… (1~2분)" : "다음 3개 초안 생성"}
      </button>
      <span className="text-[11px] text-slate-400">큐 {queued}개 대기 · 하루 소량씩 생성(안전 램프업)</span>
      {msg && <span className="text-xs font-semibold text-emerald-700">{msg}</span>}
    </div>
  );
}
