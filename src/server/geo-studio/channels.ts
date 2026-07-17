// GEO Studio · M5 — 채널 카탈로그 (원본 channels.py 이식). AI 인용 기여도(별점)·단가 정의.

export type Channel = {
  key: string;
  name: string;
  citationStars: number; // 1~5 (AI 인용율 기여도)
  contribution: string;
  contentTypes: string[];
  unitCost: number; // 콘텐츠 1건 표준 단가(원)
};

export const CATALOG: Record<string, Channel> = {
  blog: { key: "blog", name: "공식 블로그", citationStars: 5, contribution: "핵심 CEP 커버리지 · FAQ 스키마 적용", contentTypes: ["bluf-guide", "howto"], unitCost: 300000 },
  wiki: { key: "wiki", name: "위키피디아·나무위키", citationStars: 5, contribution: "최고 권위 소스 · AI 최우선 인용", contentTypes: ["definition", "fact"], unitCost: 250000 },
  naver: { key: "naver", name: "네이버 블로그", citationStars: 4, contribution: "국내 AI 학습 데이터 비중 높음", contentTypes: ["experience-review", "compare"], unitCost: 200000 },
  press: { key: "press", name: "보도자료·언론", citationStars: 4, contribution: "E-E-A-T 권위성 · 외부 인용 근거", contentTypes: ["data-press"], unitCost: 800000 },
  youtube: { key: "youtube", name: "YouTube", citationStars: 3, contribution: "영상 자막 AI 학습 · 음성 SEO", contentTypes: ["review-video", "compare-video"], unitCost: 600000 },
  reddit: { key: "reddit", name: "Reddit·포럼", citationStars: 3, contribution: "Perplexity 인용 소스 · 실사용자 신뢰", contentTypes: ["qna", "user-review"], unitCost: 150000 },
  sns: { key: "sns", name: "SNS", citationStars: 2, contribution: "인지·유입 보조", contentTypes: ["short-form"], unitCost: 150000 }
};

/** 별점 → 인용 기여 가중치(0~1). */
export function citationWeight(channelKey: string): number {
  const ch = CATALOG[channelKey];
  return ch ? ch.citationStars / 5.0 : 0.0;
}

/** 별점 내림차순 채널 목록(원본 list_channels). 동점은 삽입순 유지(안정 정렬). */
export function listChannels(): Array<Record<string, unknown>> {
  return Object.values(CATALOG)
    .slice()
    .sort((a, b) => b.citationStars - a.citationStars)
    .map((c) => ({ key: c.key, name: c.name, stars: c.citationStars, content_types: c.contentTypes, contribution: c.contribution }));
}
