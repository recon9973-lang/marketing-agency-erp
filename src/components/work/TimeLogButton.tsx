"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { logWorkTime } from "@/server/actions/time-logs";

function fmt(min: number) {
  if (min <= 0) return "0분";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간 ${m ? `${m}분` : ""}`.trim() : `${m}분`;
}

const QUICK = [15, 30, 60, 120];

export function TimeLogButton({
  workId,
  loggedMinutes,
  estimatedMinutes
}: {
  workId: string;
  loggedMinutes: number;
  estimatedMinutes: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function log(min: number) {
    if (!min || min <= 0) {
      setError("시간(분)을 입력하세요.");
      return;
    }
    setError(null);
    start(async () => {
      const res = await logWorkTime({ workItemId: workId, minutes: min, note: note || null });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMinutes("");
      setNote("");
      setOpen(false);
      router.refresh();
    });
  }

  const over = estimatedMinutes != null && estimatedMinutes > 0 && loggedMinutes > estimatedMinutes;

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-semibold text-slate-600 hover:bg-surface"
      >
        <Clock className="h-3.5 w-3.5" />
        <span className={over ? "text-danger" : "text-slate-700"}>{fmt(loggedMinutes)}</span>
        {estimatedMinutes != null && estimatedMinutes > 0 ? (
          <span className="text-slate-400">/ {fmt(estimatedMinutes)}</span>
        ) : null}
      </button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-lg border border-line bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-1">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => log(q)}
                disabled={pending}
                className="rounded-md border border-line px-2 py-1 font-semibold text-slate-600 hover:bg-surface disabled:opacity-50"
              >
                +{fmt(q)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="분"
              className="h-8 w-16 rounded-md border border-line px-2 text-xs outline-none focus:border-brand"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="메모(선택)"
              className="h-8 flex-1 rounded-md border border-line px-2 text-xs outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => log(Number(minutes))}
              disabled={pending}
              className="h-8 rounded-md bg-brand px-2.5 font-semibold text-white disabled:opacity-50"
            >
              기록
            </button>
          </div>
          {error ? <p className="text-danger">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
