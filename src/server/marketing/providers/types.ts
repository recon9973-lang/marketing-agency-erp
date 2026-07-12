// src/server/marketing/providers/types.ts
//
// VME(VENOM Marketing Engine) provider 어댑터 계층의 공통 계약.
//
// 설계 의도(기획서 §2.2, §3.2 참조):
//   같은 도메인 로직을 두 경로에서 호출한다.
//     1) 에이전트 경로: Claude 세션이 MCP 도구(네이버/Higgsfield/Canva/WordPress)를 오케스트레이션
//     2) 서버·크론 경로: 서버가 직접 외부 API를 호출(정기 배치)
//   두 경로를 이 인터페이스 뒤로 숨겨 교체·테스트·중복제거를 가능하게 한다.
//
// 이 파일은 순수 타입/인터페이스만 포함한다(런타임 코드 없음 → 기존 빌드 무영향).

/** provider 호출의 표준 결과. ERP의 ActionResult와 유사하되 서버-내부 전용. */
export type ProviderResult<T> =
  | { ok: true; data: T; meta?: ProviderMeta }
  | { ok: false; error: ProviderError };

export type ProviderMeta = {
  /** 어느 provider 구현이 처리했는지(예: "naver-datalab"). */
  source: string;
  /** 외부 호출 소요(ms). 관측/감사용. */
  elapsedMs?: number;
  /** rate-limit 잔여 등 provider가 알려준 부가정보. */
  extra?: Record<string, unknown>;
};

export type ProviderErrorCode =
  | "CONFIG_MISSING" // API 키/URL 미설정
  | "UNAUTHORIZED" // 인증 실패
  | "RATE_LIMITED" // 호출 한도 초과
  | "UPSTREAM_ERROR" // 외부 서비스 5xx/파싱 실패
  | "INVALID_INPUT" // 잘못된 요청 파라미터
  | "NOT_SUPPORTED"; // 해당 provider가 지원하지 않는 기능

export type ProviderError = {
  code: ProviderErrorCode;
  message: string;
  /** 원인 추적용(로그 전용). 사용자에게 노출 금지. */
  cause?: unknown;
};

/** 어댑터 헬퍼: 성공/실패 생성. */
export const provOk = <T>(data: T, meta?: ProviderMeta): ProviderResult<T> => ({ ok: true, data, meta });
export const provFail = (
  code: ProviderErrorCode,
  message: string,
  cause?: unknown,
): ProviderResult<never> => ({ ok: false, error: { code, message, cause } });

// ─────────────────────────────────────────────
// 도메인별 provider 인터페이스
// ─────────────────────────────────────────────

/** 키워드/트렌드/경쟁 리서치 (네이버 DataLab·검색). */
export interface ResearchProvider {
  /** 시드 키워드의 검색 트렌드(상대지수·시계열)를 조회. */
  keywordTrend(input: KeywordTrendInput): Promise<ProviderResult<KeywordTrend>>;
  /** 키워드의 블로그/웹 노출 경쟁강도(총 문서수 등)를 조회. */
  keywordCompetition(keyword: string): Promise<ProviderResult<KeywordCompetition>>;
  /** 대상(도메인/플레이스)의 키워드별 노출 순위를 조회. */
  rankCheck(input: RankCheckInput): Promise<ProviderResult<KeywordRank[]>>;
  /** 로컬(플레이스) 검색 결과 상위 목록. */
  localSearch(query: string): Promise<ProviderResult<LocalResult[]>>;
}

export type KeywordTrendInput = {
  keywords: string[];
  /** ISO date. 미지정 시 provider 기본(최근 N개월). */
  startDate?: string;
  endDate?: string;
  timeUnit?: "date" | "week" | "month";
  device?: "pc" | "mo" | "all";
  gender?: "m" | "f" | "all";
};

export type KeywordTrend = {
  keyword: string;
  /** 상대 검색량 지수 시계열. */
  series: { period: string; ratio: number }[];
}[];

export type KeywordCompetition = {
  keyword: string;
  /** 노출 총 문서수(경쟁강도 프록시). */
  totalDocs: number | null;
  channel: "blog" | "web" | "news" | "cafe";
};

export type RankCheckInput = {
  keywords: string[];
  /** 순위를 측정할 대상 도메인 또는 플레이스 ID/이름. */
  target: string;
  channel?: "blog" | "web" | "local";
};

/** keyword-rank.ts와 호환되는 순위 결과. */
export type KeywordRank = { keyword: string; rank: number | null; checkedAt: string };

export type LocalResult = {
  title: string;
  category?: string;
  address?: string;
  link?: string;
  rank: number;
};

/** SEO 블로그 초안 생성 (seo-generator / seo-writing 규격). */
export interface ContentProvider {
  draftBlogPost(input: BlogDraftInput): Promise<ProviderResult<BlogDraft>>;
}

export type BlogDraftInput = {
  keyword: string;
  /** 병원/지역업종 등 도메인 컨텍스트. 의료 주제면 컴플라이언스 게이트가 강제된다. */
  audience?: string;
  referenceUrls?: string[];
  notes?: string;
  /** 의료/건강 주제 여부. true면 medical-compliance 규칙 적용. */
  medical?: boolean;
};

/** seo-generator/seo-writing-skill과 호환되는 산출 규격. */
export type BlogDraft = {
  titleCandidates: string[]; // 5개
  recommendedTitle: string;
  metaDescription: string; // 200~300자
  outline: string[]; // 5~6개
  bodyMarkdown: string;
  faq: { q: string; a: string }[]; // 3개 이상
  hashtags: string[]; // 5개
  jsonLd?: unknown; // Article + FAQPage
};

/** SNS/광고 크리에이티브 생성 (Higgsfield / Canva). */
export interface CreativeProvider {
  generateImage(input: CreativeInput): Promise<ProviderResult<CreativeAssetOut>>;
  generateShortVideo?(input: CreativeInput): Promise<ProviderResult<CreativeAssetOut>>;
  /** 숏폼 바이럴 가능성 예측(선택). */
  predictVirality?(assetUrl: string): Promise<ProviderResult<{ score: number; notes?: string }>>;
}

export type CreativeInput = {
  prompt: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:5";
  brandRefUrls?: string[];
};

export type CreativeAssetOut = {
  kind: "image" | "short_video" | "card_news";
  url: string;
  provider: string;
  meta?: Record<string, unknown>;
};

/** 발행/배포 (WordPress / Make / 채널). */
export interface PublishProvider {
  publish(input: PublishInput): Promise<ProviderResult<PublishOut>>;
}

export type PublishInput = {
  channel: "NAVER_BLOG" | "WORDPRESS" | "INSTAGRAM" | "PLACE" | "OTHER";
  title?: string;
  bodyHtmlOrMarkdown: string;
  /** 예약 발행 시각(ISO). 없으면 즉시. */
  scheduledAt?: string;
  /** 발행에 사용할 채널 계정 식별자(자격증명 복호화는 호출부에서 처리). */
  channelAccountRef?: string;
  mediaUrls?: string[];
  /** 워드프레스 대표이미지 미디어 ID(사전 업로드). */
  featuredMediaId?: number;
  /** 워드프레스 카테고리 ID 목록. */
  categories?: number[];
};

export type PublishOut = {
  status: "PUBLISHED" | "SCHEDULED";
  externalUrl?: string;
  externalId?: string;
};
