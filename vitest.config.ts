import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", "docs/**"],
    // next-auth를 인라인 변환해야 아래 "next/server" 별칭이 적용된다(외부화되면
    // Node 네이티브 해석기가 별칭을 무시해 스위트가 죽음).
    server: { deps: { inline: [/next-auth/, /@auth\//] } }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // next-auth(v5 beta)가 베어 스펙 "next/server"를 임포트하는데, vitest의
      // pnpm 해석기가 확장자 없이 못 찾아 스위트가 통째로 죽는다. 실제 파일로 별칭.
      "next/server": path.resolve(__dirname, "node_modules/next/server.js")
    }
  }
});
