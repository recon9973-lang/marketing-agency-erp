// 목표 경로: src/components/geo/GeoLlmsTxt.tsx
//
// llms.txt 미리보기 + 복사 + 다운로드 + 색인 요청 가이드(실행 자동화 #4).
// llms.txt 본문은 서버(GEO 페이지)에서 순수 생성해 문자열로 전달받는다.
// 색인 자동 제출은 현재 구글 연동이 읽기 전용 스코프라 분리 — URL 목록 + GSC 가이드로 제공.
"use client";

import { useState } from "react";

export function GeoLlmsTxt({
  clientName,
  llmsText,
  urls,
  publicPath
}: {
  clientName: string;
  llmsText: string;
  urls: string[];
  publicPath?: string | null;
}) {
  const [copied, setCopied] = useState<null | "llms" | "urls" | "public">(null);

  async function copy(text: string, which: "llms" | "urls" | "public") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  function download() {
    const blob = new Blob([llmsText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "llms.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasPages = urls.length > 0;

  return (
    <div className="space-y-4">
      {/* llms.txt 생성 */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-ink">llms.txt — AI 크롤러 안내 파일</p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              게시된 답변 페이지를 모아 생성합니다. 병원 사이트 루트(예: seokorea.org/llms.txt)에 올리면 AI가 핵심 페이지를 우선 참고합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copy(llmsText, "llms")}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface"
            >
              {copied === "llms" ? "복사됨 ✓" : "복사"}
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              llms.txt 다운로드
            </button>
          </div>
        </div>

        {publicPath && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
            <span className="text-[11px] font-semibold text-emerald-700">공개 서빙 URL</span>
            <code className="flex-1 truncate rounded bg-white/70 px-2 py-1 text-[11px] text-slate-600">{publicPath}</code>
            <button
              type="button"
              onClick={() => copy(typeof window !== "undefined" ? window.location.origin + publicPath : publicPath, "public")}
              className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              {copied === "public" ? "복사됨 ✓" : "링크 복사"}
            </button>
          </div>
        )}

        {hasPages ? (
          <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-line bg-surface p-3 text-[11px] leading-relaxed text-slate-700">
            {llmsText}
          </pre>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-surface/50 px-3 py-6 text-center text-xs text-slate-500">
            아직 게시된 답변 페이지가 없습니다. 답변 페이지를 게시(워드프레스/URL 입력)하면 여기에 자동으로 모입니다.
          </p>
        )}
      </div>

      {/* 색인 요청 가이드 */}
      {hasPages && (
        <div className="rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">색인 요청 — 게시 페이지 {urls.length}개</p>
            <button
              type="button"
              onClick={() => copy(urls.join("\n"), "urls")}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface"
            >
              {copied === "urls" ? "복사됨 ✓" : "URL 전체 복사"}
            </button>
          </div>
          <ol className="mt-3 space-y-1">
            {urls.map((u) => (
              <li key={u} className="truncate text-[11px]">
                <a href={u} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                  {u}
                </a>
              </li>
            ))}
          </ol>
          <div className="mt-3 rounded-xl border border-line bg-surface/60 p-3 text-[11px] leading-relaxed text-slate-500">
            <p className="font-semibold text-slate-600">구글에 색인 요청하는 법</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>
                <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                  구글 서치콘솔
                </a>{" "}
                접속 → 해당 사이트 선택
              </li>
              <li>상단 “URL 검사”에 위 주소를 붙여넣기 → “색인 생성 요청”</li>
              <li>사이트맵(sitemap.xml)이 있으면 “Sitemaps”에 제출하면 신규 페이지가 자동 발견됩니다.</li>
            </ol>
            <p className="mt-1.5 text-slate-400">
              ※ 버튼 한 번으로 자동 제출하려면 구글 연동에 쓰기 권한이 필요합니다(현재 읽기 전용). 원하시면 권한 확장 후 자동화해 드립니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
