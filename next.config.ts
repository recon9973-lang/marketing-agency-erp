import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // 클라이언트 라우터 캐시 — 재방문 시 서버/Neon 재조회 없이 즉시 전환.
  // Next 15 기본 dynamic=0(항상 재조회) → 캐시 유지. 한 번 연 탭들 사이를 오갈 때
  // 서버 왕복 없이 즉시 전환된다(베놈 관리자 느낌). 서버액션의 revalidatePath로
  // 변경 후엔 자동 무효화되므로 데이터 신선도는 유지된다.
  experimental: {
    staleTimes: { dynamic: 120, static: 300 }
  },
  // 상권분석 좌표 데이터셋(gz)은 fs 로 런타임에 읽으므로, 해당 라우트 번들에 포함시킨다.
  outputFileTracingIncludes: {
    "/market": ["./src/server/data/region/*.gz"],
    "/insights": ["./src/server/data/region/*.gz"]
  },
  // Konva(react-konva)는 브라우저 전용으로만 로드된다(디자인 스튜디오, ssr:false).
  // Node 진입점이 선택적 네이티브 의존성 'canvas'를 참조하는데, 서버에서 렌더하지
  // 않으므로 빈 모듈로 별칭 처리해 번들 오류를 없앤다.
  webpack: (config, { isServer, webpack }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    // pptxgenjs(브라우저 다운로드용)는 node:fs/https 등을 정적 import 하지만 브라우저에선
    // 쓰지 않는다. exports 필드 탓에 package.json 의 browser 매핑이 무시되므로,
    // 클라이언트 번들에서 node: 프리픽스를 제거하고 Node 빌트인을 빈 모듈로 스텁한다.
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (r: { request: string }) => {
          r.request = r.request.replace(/^node:/, "");
        })
      );
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        https: false,
        http: false,
        os: false,
        path: false,
        zlib: false,
        stream: false,
        crypto: false
      };
    }
    return config;
  }
};

export default nextConfig;
