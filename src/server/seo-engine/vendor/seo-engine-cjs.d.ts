// 벤더된 UMD/CJS 엔진 파일(seo-engine.cjs)의 런타임 타입. 정본 저장소에서 동기화되며 직접 수정 금지.
declare module "*/seo-engine.cjs" {
  import type { SeoEngineResult } from "./seo-engine";
  const SEOEngine: {
    version: string;
    analyze(input: {
      url: string;
      html: string;
      robots?: string;
      isHttps?: boolean;
      doc?: unknown;
      keyword?: string;
    }): SeoEngineResult;
    mergePSI(result: SeoEngineResult, psiJson: unknown): SeoEngineResult;
    renderInfographic(result: SeoEngineResult, opts?: Record<string, unknown>): string;
  };
  export default SEOEngine;
}
