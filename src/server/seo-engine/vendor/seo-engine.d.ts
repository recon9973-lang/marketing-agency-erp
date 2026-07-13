// 벤더된 VENOM SEO 엔진 결과 타입. 엔진 로직(seo-engine.cjs)은 의존성 0 자바스크립트이며,
// 런타임 값의 타입은 seo-engine-cjs.d.ts(와일드카드 모듈 선언)가 제공한다. 이 파일은 결과 형태만 정의.
export interface SeoEngineItem {
  name: string;
  desc: string;
  points: number;
  pass: boolean | null;
  source: string;
}
export interface SeoEngineCategory {
  key: string;
  label: string;
  icon: string;
  color: string;
  max: number;
  score: number;
  pending: boolean;
  pct: number;
  items: SeoEngineItem[];
}
export interface SeoEngineResult {
  version: string;
  url: string;
  domain: string;
  isHttps: boolean;
  isSPA: boolean;
  categories: SeoEngineCategory[];
  baseTotal: number;
  baseMax: number;
  speedCat: SeoEngineCategory | null;
  total: number;
  max: number;
  hasPSI: boolean;
  psi: unknown;
  summary: {
    passed: number;
    failed: number;
    pending: number;
    totalItems: number;
    passRate: number;
    improvable: number;
  };
  grade: { label: string; color: string; desc: string };
}
