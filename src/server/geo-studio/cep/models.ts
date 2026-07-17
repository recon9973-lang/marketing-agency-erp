// GEO Studio · M2 CEP 파인더 — 도메인 모델 (원본 cep_finder/models.py 이식).
// 필드는 기획안 4.1 스키마(cep_entries 등)에 1:1 대응. toRow()는 파이썬 asdict 재현(snake_case).

export const TAG_AXES = ["situation", "emotion", "time", "place", "companion"] as const;
export type TagAxis = (typeof TAG_AXES)[number];

/** AI 응답에서 추출한 CEP 원석(클러스터링 전). */
export type CepCandidate = {
  text: string;
  sourceAi: string;
  keyword: string;
  probe: string;
  brandMentioned: boolean;
  competitorsMentioned: string[];
};

export function candidateToRow(c: CepCandidate): Record<string, unknown> {
  return {
    text: c.text,
    source_ai: c.sourceAi,
    keyword: c.keyword,
    probe: c.probe,
    brand_mentioned: c.brandMentioned,
    competitors_mentioned: c.competitorsMentioned
  };
}

/** 클러스터링·태깅·점수화를 마친 최종 CEP(cep_entries). */
export type Cep = {
  cepText: string;
  situationTag: string;
  emotionTag: string;
  timeTag: string;
  placeTag: string;
  companionTag: string;
  priorityScore: number;
  aiMentionCount: number;
  isWhitespace: boolean;
  keywords: string[];
  sourceAis: string[];
  memberTexts: string[];
  brandMentionCount: number;
  competitorNames: string[];
};

export function cepTags(c: Cep): Record<TagAxis, string> {
  return {
    situation: c.situationTag,
    emotion: c.emotionTag,
    time: c.timeTag,
    place: c.placeTag,
    companion: c.companionTag
  };
}

/** cep_entries 적재용 dict(asdict 순서·이름 재현). */
export function cepToRow(c: Cep): Record<string, unknown> {
  return {
    cep_text: c.cepText,
    situation_tag: c.situationTag,
    emotion_tag: c.emotionTag,
    time_tag: c.timeTag,
    place_tag: c.placeTag,
    companion_tag: c.companionTag,
    priority_score: c.priorityScore,
    ai_mention_count: c.aiMentionCount,
    is_whitespace: c.isWhitespace,
    keywords: c.keywords,
    source_ais: c.sourceAis,
    member_texts: c.memberTexts,
    brand_mention_count: c.brandMentionCount,
    competitor_names: c.competitorNames
  };
}

/** 새 CEP 생성 헬퍼(원본 dataclass 기본값). */
export function makeCep(p: Partial<Cep> & { cepText: string }): Cep {
  return {
    situationTag: "",
    emotionTag: "",
    timeTag: "",
    placeTag: "",
    companionTag: "",
    priorityScore: 0,
    aiMentionCount: 0,
    isWhitespace: false,
    keywords: [],
    sourceAis: [],
    memberTexts: [],
    brandMentionCount: 0,
    competitorNames: [],
    ...p
  };
}

export type CompetitorCep = {
  competitorName: string;
  cepText: string;
  mentionStrength: number;
  sourceAi: string;
};

export type ContentBrief = {
  cepText: string;
  contentType: string;
  workingTitle: string;
  targetPersona: string;
  searchIntent: string;
  keyMessages: string[];
  outline: string[];
  seoKeywords: string[];
  tone: string;
  recommendedChannel: string;
  cta: string;
};

/** ContentBrief → 마크다운(원본 to_markdown 재현). */
export function briefToMarkdown(b: ContentBrief): string {
  const lines = [
    `# 콘텐츠 브리프 — ${b.workingTitle}`,
    "",
    `- **CEP**: ${b.cepText}`,
    `- **콘텐츠 유형**: ${b.contentType}`,
    `- **타겟 페르소나**: ${b.targetPersona}`,
    `- **검색 의도**: ${b.searchIntent}`,
    `- **톤앤매너**: ${b.tone}`,
    `- **추천 채널**: ${b.recommendedChannel}`,
    "",
    "## 핵심 메시지",
    ...b.keyMessages.map((m) => `- ${m}`),
    "",
    "## 콘텐츠 아웃라인",
    ...b.outline.map((h, i) => `${i + 1}. ${h}`),
    "",
    "## SEO/GEO 키워드",
    `${b.seoKeywords.join(", ")}`,
    "",
    `## CTA\n${b.cta}`
  ];
  return lines.join("\n");
}
