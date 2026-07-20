"use client";

// 대시보드 위젯 — 개인 메모장(계정별 DB 저장). 입력이 멈추면 자동 저장.
import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { saveMemo } from "@/server/actions/memo";

export function MemoPad({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(initial);

  useEffect(() => {
    if (value === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    setState("saving");
    timer.current = setTimeout(async () => {
      const res = await saveMemo({ content: value });
      if (res.ok) {
        lastSaved.current = value;
        setState("saved");
        setTimeout(() => setState("idle"), 1500);
      } else {
        setState("idle");
      }
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-bold text-ink">메모장</h2>
        </div>
        <span className="text-[11px] text-slate-400">
          {state === "saving" ? "저장 중…" : state === "saved" ? "저장됨 ✓" : "자동 저장"}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="개인 메모를 적어두세요. 입력을 멈추면 자동 저장됩니다(나만 볼 수 있음)."
        className="mt-3 min-h-[140px] flex-1 resize-none rounded-lg border border-line bg-surface/30 px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-brand"
      />
    </section>
  );
}
