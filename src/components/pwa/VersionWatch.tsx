"use client";

import { useEffect, useState } from "react";

// 새 배포 감지 — 번들에 구워진 SHA와 서버의 현재 SHA를 대조해 다르면
// "새 버전" 배너를 띄운다. 잦은 재배포 + 설치형 앱(PWA) 조합에서
// 사용자가 옛 화면을 보며 "배포가 안 됐다"고 오해하는 문제의 근본 해결책.
// 새로고침 버튼은 서비스 워커 캐시까지 비우고 완전히 다시 불러온다.
const BUILT_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function fetchServerSha(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    const data = await res.json();
    return typeof data.sha === "string" ? data.sha : null;
  } catch {
    return null;
  }
}

async function hardReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* 캐시 정리 실패해도 새로고침은 진행 */
  }
  window.location.reload();
}

export function VersionWatch() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (BUILT_SHA === "dev") return; // 로컬 개발에서는 감시하지 않음
    let stopped = false;

    const check = async () => {
      const sha = await fetchServerSha();
      if (!stopped && sha && sha !== "dev" && sha !== BUILT_SHA) setOutdated(true);
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!outdated) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-emerald-500/40 bg-slate-900/95 px-4 py-2.5 text-sm text-white shadow-xl backdrop-blur">
        <span aria-hidden>🔄</span>
        <span>새 버전이 배포되었습니다.</span>
        <button
          onClick={hardReload}
          className="rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-400"
        >
          지금 새로고침
        </button>
      </div>
    </div>
  );
}
