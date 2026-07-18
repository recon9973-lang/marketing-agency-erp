// GEO Studio · M3 콘텐츠 빌더 — 도메인 모델 (원본 models.py 이식 · 분석 코어 부분).

export type GeoScore = {
  total: number;
  bluf: number;
  faqCoverage: number;
  citationPotential: number;
  eeat: number;
  structuredData: number;
  suggestions: Array<{ type: string; priority: string; message: string }>;
};

export function geoScoreToRow(s: GeoScore): Record<string, unknown> {
  return {
    geo_score: s.total,
    bluf_score: s.bluf,
    faq_score: s.faqCoverage,
    eeat_score: s.eeat,
    citation_score: s.citationPotential
  };
}

export type FaqItem = { question: string; answer: string };

export type FaqSchema = {
  items: FaqItem[];
  jsonLd: string;
  isDeployed: boolean;
};

export function faqToRow(f: FaqSchema): Record<string, unknown> {
  return {
    faq_items: f.items.map((i) => ({ question: i.question, answer: i.answer })),
    json_ld_code: f.jsonLd,
    is_deployed: f.isDeployed
  };
}

export type EeatReport = {
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  total: number;
  missingSignals: string[];
  suggestions: string[];
};
