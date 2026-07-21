// Next.js instrumentation — 서버(nodejs) 부팅 시 1회 실행.
// 스키마 드리프트 근본 차단: 운영 DB에 누락된 컬럼·enum 값을 자동 보강(additive).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureSchema } = await import("./server/ensure-schema");
    // 부팅을 막지 않도록 백그라운드로. (첫 요청 전 완료되지 못하면 각 액션의 개별 ensure가 커버)
    void ensureSchema();
  } catch (e) {
    console.warn("[instrumentation] ensureSchema 로드 실패(무시):", String(e).slice(0, 140));
  }
}
