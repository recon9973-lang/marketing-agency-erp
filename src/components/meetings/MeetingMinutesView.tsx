"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// AI 회의록(마크다운의 좁은 부분집합)을 보기 좋게 렌더. 외부 의존성 없이 라인 파싱.
function renderLines(md: string) {
  const lines = md.split("\n");
  return lines.map((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) return <div key={i} className="h-2" />;
    if (line.startsWith("## ")) {
      return (
        <h4 key={i} className="mt-4 border-l-2 border-brand pl-2 text-sm font-bold text-brand-strong">
          {line.slice(3)}
        </h4>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <h5 key={i} className="mt-3 text-sm font-semibold text-ink">
          {line.slice(4)}
        </h5>
      );
    }
    const checkbox = line.match(/^-\s*\[( |x|X)\]\s*(.*)$/);
    if (checkbox) {
      const done = checkbox[1].toLowerCase() === "x";
      return (
        <div key={i} className="flex items-start gap-2 pl-1 text-sm text-slate-700">
          <span className={"mt-0.5 " + (done ? "text-emerald-600" : "text-slate-400")}>{done ? "☑" : "☐"}</span>
          <span>{checkbox[2]}</span>
        </div>
      );
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <div key={i} className="flex items-start gap-2 pl-1 text-sm text-slate-700">
          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
          <span>{line.slice(2)}</span>
        </div>
      );
    }
    return (
      <p key={i} className="text-sm text-slate-700">
        {line}
      </p>
    );
  });
}

export function MeetingMinutesView({ minutes }: { minutes: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(minutes);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 무시 */
    }
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">📝 회의록</h3>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <div className="mt-3 space-y-1">{renderLines(minutes)}</div>
    </div>
  );
}
