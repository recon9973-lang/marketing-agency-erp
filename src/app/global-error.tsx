"use client";

// 최상위 오류 경계 — 클라이언트 렌더가 통째로 죽었을 때(예: 스테일 번들 → 죽은 청크
// 참조로 인한 "client-side exception") 흰 화면 대신 이 안내를 보여준다.
// "새로고침"은 브라우저 캐시·서비스워커를 정리하고 최신 번들로 하드 리로드한다.
// global-error는 root layout을 대체하므로 자체 <html>/<body>를 렌더해야 한다.
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 콘솔에 원인을 남겨 진단을 돕는다(사용자 화면에는 노출하지 않음).
    console.error("[global-error]", error?.message, error?.digest);
  }, [error]);

  async function hardReload() {
    try {
      if (typeof window !== "undefined" && window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      /* 정리 실패해도 리로드는 진행 */
    }
    window.location.reload();
  }

  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#0c0b0f",
            color: "#fff",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: 24
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <p style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#d9662e", margin: "0 0 14px", fontWeight: 700 }}>
              VENOM ERP
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>화면을 불러오지 못했습니다</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.55)", margin: "0 0 22px" }}>
              앱이 업데이트되어 이전 화면 자료가 남아 있을 수 있습니다. 아래 버튼으로 최신 버전을 다시 불러오면 대부분 해결됩니다.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={hardReload}
                style={{
                  height: 44,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "#d9662e",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                새로고침(캐시 정리)
              </button>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  height: 44,
                  padding: "0 20px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.8)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                다시 시도
              </button>
            </div>
            <p style={{ marginTop: 20 }}>
              <a href="/login" style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                로그인 화면으로 이동
              </a>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
