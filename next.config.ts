import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // 클라이언트 라우터 캐시 — 재방문 시 서버/Neon 재조회 없이 즉시 전환.
  // Next 15 기본 dynamic=0(항상 재조회) → 30s 캐시. 서버액션의 revalidatePath로
  // 변경 후엔 자동 무효화되므로 데이터 신선도 유지.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 }
  }
};

export default nextConfig;
