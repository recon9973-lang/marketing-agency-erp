"use client";

import { useState } from "react";

/** 청구 결제 링크를 보여주고 복사한다. */
export function BillingPayLink({ url, configured }: { url: string; configured: boolean }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">결제 링크</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            configured ? "bg-brand/10 text-brand" : "bg-surface text-slate-500"
          }`}
        >
          {configured ? "토스 결제 연동됨" : "미연동(데모 결제)"}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        이 링크를 거래처에 보내면 결제 페이지가 열립니다.{" "}
        {configured
          ? "토스 결제창에서 카드로 결제합니다."
          : "지금은 데모 결제로 동작합니다. TOSS_SECRET_KEY·TOSS_CLIENT_KEY를 넣으면 실제 결제로 바뀝니다. (코드 변경 없음)"}
      </p>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-slate-600"
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
          className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-surface"
        >
          {copied ? "복사됨" : "복사"}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-brand transition hover:bg-surface"
        >
          열기 ↗
        </a>
      </div>
    </div>
  );
}
