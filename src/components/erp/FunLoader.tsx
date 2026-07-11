"use client";

// 브랜드 로딩 인터랙션 — 콜드/전환 대기를 "느림" 대신 "연출"로. (erp)/loading.tsx에서 사용.
// 로터리 메시지 + VENOM 워드마크(핑 도트) + 스윕 프로그레스 + 떠다니는 스파클.
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/erp/BrandLogo";

const MESSAGES = [
  "거래처 인사이트 불러오는 중…",
  "채널별 방문자 집계 중…",
  "검색 순위 확인 중… 📈",
  "의료법 위험 스캔 중… 🛡️",
  "AI가 열일 중… ⚡",
  "오렌지 한 스푼 추가 중… 🍊"
];

export function FunLoader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-[62vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* 떠다니는 스파클 */}
      <div className="pointer-events-none relative mb-1 h-20 w-64">
        <Sparkles className="animate-venom-float absolute left-6 top-2 h-5 w-5 text-brand" style={{ animationDelay: "0ms" }} />
        <Sparkles className="animate-venom-float absolute right-10 top-0 h-4 w-4 text-violet-400" style={{ animationDelay: "500ms" }} />
        <Sparkles className="animate-venom-float absolute left-1/2 bottom-1 h-3.5 w-3.5 text-blue-400" style={{ animationDelay: "1000ms" }} />
        <Sparkles className="animate-venom-float absolute right-6 bottom-3 h-3 w-3 text-emerald-400" style={{ animationDelay: "1500ms" }} />
      </div>

      {/* 워드마크 + 핑 도트 */}
      <BrandLogo tone="auto" animateDot className="text-4xl" />
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">MARKETING ERP</p>

      {/* 스윕 프로그레스 */}
      <div className="relative mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-line">
        <div className="animate-venom-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-brand-soft via-brand to-brand-strong" />
      </div>

      {/* 로터리 메시지 */}
      <p key={i} className="animate-venom-fadeup mt-4 text-sm font-medium text-slate-500">
        {MESSAGES[i]}
      </p>
    </div>
  );
}
