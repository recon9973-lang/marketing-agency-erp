"use client";

// DB 워밍 하트비트 — ERP가 열려 있는 동안 4분마다 /api/ping 호출로 Neon 컴퓨트를
// 깨어 있게 유지(유휴 스케일다운 방지 → 화면 전환 시 콜드 웨이크업 지연 제거).
// 탭이 숨겨지면 멈추고, 다시 보이면 즉시 한 번 깨운 뒤 재개해 리소스를 아낀다.
import { useEffect } from "react";

const INTERVAL_MS = 4 * 60 * 1000; // Neon 기본 유휴 5분보다 짧게

export function KeepWarm() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const ping = () => {
      fetch("/api/ping", { cache: "no-store", keepalive: true }).catch(() => {});
    };
    const start = () => {
      if (timer) return;
      ping();
      timer = setInterval(ping, INTERVAL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
