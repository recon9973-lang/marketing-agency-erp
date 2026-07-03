"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 폴링 기반 새 메시지 반영 (기획 결정: 서버리스 환경에서 WebSocket 대신 폴링).
 * 화면이 보이는 동안 주기적으로 서버 데이터를 다시 불러온다.
 */
export function ChatPoller({ intervalMs = 7000 }: { intervalMs?: number }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    timer.current = setInterval(tick, intervalMs);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [router, intervalMs]);

  return null;
}
