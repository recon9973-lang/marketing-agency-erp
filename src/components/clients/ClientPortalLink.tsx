// 목표 경로: src/components/clients/ClientPortalLink.tsx
//
// 거래처 포털 링크 발급/복사 — 관리자·담당자가 거래처에 전달할 공개 링크.
"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { issuePortalToken } from "@/server/actions/client-portal";

export function ClientPortalLink({ clientId, token }: { clientId: string; token: string | null }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState<string | null>(token);
  const [copied, setCopied] = useState(false);

  const url = current && typeof window !== "undefined" ? `${window.location.origin}/portal/${current}` : "";

  function issue(reset: boolean) {
    start(async () => {
      const res = await issuePortalToken({ clientId, reset });
      if (res.ok && res.data) setCurrent(res.data.token);
    });
  }
  function copy() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface/40 p-3">
      <p className="text-xs font-bold text-slate-500">거래처 포털 링크</p>
      <p className="mt-0.5 text-xs text-slate-400">거래처가 로그인 없이 콘텐츠 컨펌·보고서 확인·피드백을 할 수 있는 링크입니다.</p>
      {current ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input readOnly value={url} className="min-w-0 flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-slate-600" />
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface"><Copy className="h-3.5 w-3.5" /> {copied ? "복사됨" : "복사"}</button>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface"><ExternalLink className="h-3.5 w-3.5" /> 열기</a>
          <button type="button" onClick={() => issue(true)} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:bg-surface disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> 재발급</button>
        </div>
      ) : (
        <button type="button" onClick={() => issue(false)} disabled={pending} className="mt-2 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? "발급 중…" : "포털 링크 발급"}</button>
      )}
    </div>
  );
}
