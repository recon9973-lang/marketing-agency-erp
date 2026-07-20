"use client";

import { useEffect } from "react";

// 서비스 워커 등록 + 스테일 번들 자가치유.
// PWA는 잦은 재배포 후 브라우저/구(舊) SW가 이미 삭제된 _next 청크를 참조해
// "client-side exception"으로 화면이 통째로 죽는 일이 있다. 이를 감지하면
// 캐시·SW를 정리하고 딱 한 번 새로고침해 최신 번들로 스스로 복구한다.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 등록 실패는 앱 동작에 영향 없음 */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    // 청크 로드 실패 → 캐시·SW 제거 후 1회 하드 리로드(무한 루프 방지 플래그).
    const HEAL_KEY = "venom-chunk-heal";
    const healOnce = () => {
      try {
        if (sessionStorage.getItem(HEAL_KEY) === "1") return;
        sessionStorage.setItem(HEAL_KEY, "1");
      } catch {
        /* 프라이빗 모드 등 sessionStorage 불가 시엔 그냥 진행 */
      }
      Promise.resolve()
        .then(() => (window.caches ? caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))) : null))
        .then(() => navigator.serviceWorker.getRegistrations())
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {})
        .finally(() => window.location.reload());
    };
    const isChunkError = (msg: string) =>
      /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|import\(\) failed|Failed to fetch/i.test(msg);
    const onError = (e: ErrorEvent) => {
      if (e?.message && isChunkError(e.message)) healOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e?.reason as { message?: string } | string | undefined;
      const msg = typeof r === "string" ? r : String(r?.message ?? r ?? "");
      if (isChunkError(msg)) healOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // 로드가 정상적으로 끝나면 자가치유 플래그를 비워 다음 세션에 대비.
    const clearFlag = () => {
      try {
        sessionStorage.removeItem(HEAL_KEY);
      } catch {
        /* noop */
      }
    };
    window.addEventListener("load", clearFlag, { once: true });

    return () => {
      window.removeEventListener("load", register);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
