// AI 마케팅 엔진의 Claude 호출부.
// 규칙: ANTHROPIC_API_KEY 가 env에 있으면 켜지고, 없으면 isAiConfigured()=false.
// 공식 SDK(@anthropic-ai/sdk) 사용. 모델 기본값 claude-opus-4-8 + adaptive thinking,
// 긴 출력을 대비해 stream() 후 finalMessage()로 완성본을 받는다.
import Anthropic from "@anthropic-ai/sdk";
import { redactPII } from "@/server/compliance/pii";

export const AI_MODEL = "claude-opus-4-8";

export type AiContentKind = "BLOG" | "CARD_NEWS" | "SNS" | "AD_COPY" | "KEYWORD";

export const AI_KIND_LABELS: Record<AiContentKind, string> = {
  BLOG: "블로그 원고",
  CARD_NEWS: "카드뉴스",
  SNS: "SNS 캡션",
  AD_COPY: "광고 문구",
  KEYWORD: "SEO 키워드"
};

/** env에 키가 있으면 AI 생성이 활성화된다. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type GenerateInput = {
  kind: AiContentKind;
  topic: string;
  keywords?: string | null;
  tone?: string | null;
  clientName?: string | null;
  industry?: string | null;
};

/** 종류별 세부 지시. 마케팅 대행사 실무 톤에 맞춘 한국어 산출물. */
const KIND_DIRECTIVE: Record<AiContentKind, string> = {
  BLOG:
    "네이버 블로그에 바로 올릴 수 있는 정보성 포스트를 작성하세요. 후킹 제목 후보 2개, 도입부, 소제목(H2)으로 구분된 본문 3~5개 섹션, 자연스러운 마무리 CTA를 포함합니다. 과장·의료광고 위반 표현은 피합니다.",
  CARD_NEWS:
    "인스타그램 카드뉴스 원고를 작성하세요. 표지 포함 6~8장 구성으로, 각 장을 '1장: ...' 형식으로 번호와 함께 짧은 카피(각 40자 이내)로 제시하고, 마지막 장에 행동유도(CTA)를 넣습니다.",
  SNS:
    "인스타그램/페이스북용 짧은 캡션을 작성하세요. 첫 문장으로 시선을 끌고, 3~5줄 본문, 이모지 적절히, 마지막에 관련 해시태그 8~12개를 제시합니다.",
  AD_COPY:
    "성과형 광고 카피를 작성하세요. 헤드라인 후보 5개(각 20자 이내)와 디스크립션 후보 3개(각 45자 이내)를 제시합니다. 클릭을 유도하되 허위·과장은 피합니다.",
  KEYWORD:
    "SEO/검색광고용 키워드를 제안하세요. 핵심 키워드 10개, 롱테일 키워드 10개, 각 키워드 옆에 (정보성/구매성) 의도 라벨을 붙여 목록으로 제시합니다."
};

function buildPrompt(input: GenerateInput): { system: string; user: string } {
  const system =
    "당신은 한국의 마케팅 대행사에서 일하는 전문 카피라이터이자 콘텐츠 전략가입니다. " +
    "요청받은 형식에 맞춰 실무에서 바로 쓸 수 있는 한국어 마케팅 콘텐츠를 만듭니다. " +
    "결과만 마크다운으로 깔끔하게 출력하고, 사족·해설·메타설명은 넣지 않습니다.";

  const lines: string[] = [];
  lines.push(`# 작업: ${AI_KIND_LABELS[input.kind]} 생성`);
  lines.push("");
  lines.push(KIND_DIRECTIVE[input.kind]);
  lines.push("");
  lines.push("## 입력 정보");
  if (input.clientName) lines.push(`- 거래처/브랜드: ${input.clientName}`);
  if (input.industry) lines.push(`- 업종: ${input.industry}`);
  lines.push(`- 주제/핵심 메시지: ${input.topic}`);
  if (input.keywords) lines.push(`- 강조 키워드: ${input.keywords}`);
  if (input.tone) lines.push(`- 톤앤매너: ${input.tone}`);

  return { system, user: lines.join("\n") };
}

/**
 * Claude로 마케팅 콘텐츠를 생성해 완성 텍스트를 반환.
 * 키가 없으면 명확한 에러를 던진다(상위에서 AI_NOT_CONFIGURED로 처리).
 */
export async function generateMarketingContent(input: GenerateInput): Promise<string> {
  if (!isAiConfigured()) {
    throw new Error("AI_NOT_CONFIGURED");
  }
  const client = new Anthropic();
  const { system, user } = buildPrompt(input);

  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: user }]
  });

  const message = await stream.finalMessage();
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("AI_EMPTY");
  return text;
}

/** 응답에서 JSON 객체만 안전하게 추출(코드펜스/설명 섞여도). */
function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI_EMPTY");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

async function completeJson<T>(system: string, user: string, maxTokens = 8000): Promise<T> {
  if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: user }]
  });
  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return extractJson<T>(text);
}

export type BlogPostInput = {
  category?: string | null;
  keyword: string;
  region?: string | null;
  extra?: string | null;
  target?: string | null;
  tone?: string | null;
  detail?: string | null;
};

export type BlogPost = {
  title: string;
  html: string;
  metaDesc: string;
  keywords: string[];
  publishable: boolean;
};

/** 원고 스튜디오 "원고 생성" — 구조화된 블로그 포스트(HTML 본문 포함)를 생성. */
export async function generateBlogPost(input: BlogPostInput): Promise<BlogPost> {
  const system =
    "당신은 한국의 마케팅 대행사 소속 전문 블로그 카피라이터이자 SEO 에디터입니다. " +
    "네이버/구글 검색에 잘 잡히는 정보성 블로그 글을 작성합니다. " +
    "의료·건강 주제라면 의료광고법을 준수해 과장·단정·최상급 표현을 피합니다. " +
    "반드시 아래 JSON 스키마 하나만 출력하세요(설명·코드펜스 금지):\n" +
    '{"title": string, "html": string, "metaDesc": string, "keywords": string[], "publishable": boolean}\n' +
    "html은 <h2>/<p>/<ul>/<li> 등 시맨틱 태그로 구성된 본문 HTML(‹html›/‹body› 태그 없이 본문만). " +
    "publishable은 의료광고·과장표현 위반이 없어 바로 발행 가능하면 true.";

  const lines = [
    `핵심 키워드: ${input.keyword}`,
    input.category ? `카테고리/업종: ${input.category}` : "",
    input.region ? `지역: ${input.region}` : "",
    input.target ? `타깃 독자: ${input.target}` : "",
    input.tone ? `톤앤매너: ${input.tone}` : "",
    input.detail ? `분량/세부 지시: ${input.detail}` : "",
    input.extra ? `추가 요청: ${input.extra}` : ""
  ].filter(Boolean);

  const post = await completeJson<BlogPost>(system, `다음 조건으로 블로그 글을 작성하세요.\n${lines.join("\n")}`);
  return {
    title: String(post.title ?? ""),
    html: String(post.html ?? ""),
    metaDesc: String(post.metaDesc ?? ""),
    keywords: Array.isArray(post.keywords) ? post.keywords.map(String) : [],
    publishable: Boolean(post.publishable)
  };
}

export type SeoBlogDraftInput = {
  keyword: string;
  audience?: string | null;
  notes?: string | null;
  referenceUrls?: string[];
  medical?: boolean;
};

export type SeoBlogDraft = {
  titleCandidates: string[];
  recommendedTitle: string;
  metaDescription: string;
  outline: string[];
  bodyMarkdown: string;
  faq: { q: string; a: string }[];
  hashtags: string[];
};

/**
 * SEO/GEO 블로그 구조화 초안 — 외부 seo-generator 없이 Claude로 직접 생성.
 * 제목후보·아웃라인·본문(MD)·FAQ·해시태그를 한 번에 만들어 BlogDraft로 매핑 가능하게 한다.
 * FAQ/아웃라인은 AEO/GEO(추천 스니펫·AI 답변 인용) 신호라 반드시 채운다.
 */
export async function generateSeoBlogDraft(input: SeoBlogDraftInput): Promise<SeoBlogDraft> {
  const system =
    "당신은 한국 마케팅 대행사의 SEO/GEO 전문 블로그 에디터입니다. " +
    "검색엔진과 생성형 AI(ChatGPT·Perplexity 등) 답변에 모두 인용되기 좋은 정보성 글을 씁니다. " +
    "핵심 답을 첫 문단에 두고(BLUF), 질문형 소제목과 FAQ로 구조화합니다. " +
    (input.medical
      ? "의료·건강 주제이므로 의료광고법을 엄격히 준수하세요: 치료효과 단정·보장, 최상급/유일성, 전후비교·비급여 유인, 타 병원 비교를 쓰지 말고, 효과 언급 시 부작용·개인차·전문의 상담 필요를 함께 적으세요. "
      : "") +
    "반드시 아래 JSON 스키마 하나만 출력하세요(설명·코드펜스 금지):\n" +
    '{"titleCandidates": string[5], "recommendedTitle": string, "metaDescription": string, "outline": string[5..6], "bodyMarkdown": string, "faq": [{"q": string, "a": string}] (3개 이상), "hashtags": string[5]}\n' +
    "metaDescription은 200~300자. bodyMarkdown은 ##/###·목록을 쓴 마크다운 본문(제목 h1은 넣지 말 것). hashtags는 # 포함.";

  const lines = [
    `핵심 키워드: ${input.keyword}`,
    input.audience ? `도메인/타깃: ${input.audience}` : "",
    input.notes ? `추가 지시/소스: ${input.notes}` : "",
    input.referenceUrls && input.referenceUrls.length ? `참고 URL: ${input.referenceUrls.join(", ")}` : ""
  ].filter(Boolean);

  const d = await completeJson<SeoBlogDraft>(
    system,
    `다음 조건으로 SEO/GEO 블로그 초안을 작성하세요.\n${lines.join("\n")}`
  );

  const titleCandidates = Array.isArray(d.titleCandidates) ? d.titleCandidates.map(String).filter(Boolean) : [];
  const recommendedTitle = String(d.recommendedTitle ?? titleCandidates[0] ?? input.keyword);
  return {
    titleCandidates: titleCandidates.length ? titleCandidates : [recommendedTitle],
    recommendedTitle,
    metaDescription: String(d.metaDescription ?? ""),
    outline: Array.isArray(d.outline) ? d.outline.map(String).filter(Boolean) : [],
    bodyMarkdown: String(d.bodyMarkdown ?? ""),
    faq: Array.isArray(d.faq)
      ? d.faq.map((f) => ({ q: String(f?.q ?? ""), a: String(f?.a ?? "") })).filter((f) => f.q && f.a)
      : [],
    hashtags: Array.isArray(d.hashtags) ? d.hashtags.map(String).filter(Boolean) : []
  };
}

/** 회의 전사/메모를 구조화된 회의록(마크다운)으로 정리. */
export async function generateMeetingMinutes(
  transcript: string,
  context?: { title?: string | null; clientName?: string | null; attendees?: string[] }
): Promise<string> {
  if (!isAiConfigured()) throw new Error("AI_NOT_CONFIGURED");
  // 개인정보 익명화(§9 AI사용) — 전사에 섞인 환자 식별정보(주민번호·전화·이메일·카드)는 AI로 보내기 전 마스킹.
  const safeTranscript = redactPII(transcript).text;
  const client = new Anthropic();
  const system =
    "당신은 한국 마케팅 대행사의 회의록 서기입니다. 회의 녹취/메모를 받아 깔끔한 한국어 회의록으로 정리합니다. " +
    "반드시 아래 마크다운 구조로만 출력하세요(추측성 내용 금지, 녹취에 없는 사실 지어내지 말 것):\n" +
    "## 회의 개요 (한두 줄 요약)\n## 주요 논의\n- (항목별)\n## 결정 사항\n- (합의/결정)\n## 액션 아이템\n- [ ] 담당자 — 할 일 (기한)\n## 기타/공유";
  const meta = [
    context?.title ? `회의명: ${context.title}` : "",
    context?.clientName ? `거래처: ${context.clientName}` : "",
    context?.attendees && context.attendees.length ? `참석자: ${context.attendees.join(", ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
  const user = `${meta ? meta + "\n\n" : ""}아래는 회의 녹취/메모 원문입니다. 이를 회의록으로 정리하세요.\n\n---\n${safeTranscript}`;

  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: user }]
  });
  const message = await stream.finalMessage();
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("AI_EMPTY");
  return text;
}

export type KeywordSuggestion = { related: string[]; questions: string[] };

/** 원고 스튜디오 "연관 키워드" — 핵심 키워드로 연관어/질문형 키워드 제안. */
export async function suggestKeywords(keyword: string, region?: string | null): Promise<KeywordSuggestion> {
  const system =
    "당신은 한국어 SEO 키워드 전문가입니다. 주어진 핵심 키워드로 검색 의도에 맞는 " +
    "연관 키워드와 사람들이 실제로 검색하는 질문형 키워드를 제안합니다. " +
    '반드시 이 JSON만 출력하세요: {"related": string[], "questions": string[]}. ' +
    "related는 12~16개(롱테일 포함), questions는 6~10개.";
  const user = `핵심 키워드: ${keyword}${region ? `\n지역: ${region}` : ""}`;
  const res = await completeJson<KeywordSuggestion>(system, user, 2000);
  return {
    related: Array.isArray(res.related) ? res.related.map(String) : [],
    questions: Array.isArray(res.questions) ? res.questions.map(String) : []
  };
}

export type ConsultingInput = { hospitalName: string; address?: string | null; departments?: string | null; competitors?: string | null };
export type ConsultingKeyword = { keyword: string; intent: string; priority: number; channel: string };
export type ConsultingResult = {
  coreKeywords: ConsultingKeyword[];
  competitorAnalysis: string;
  marketAnalysis: string;
  summary: string;
};

/** 영업 컨설팅 — 병원명·주소·진료과로 핵심 키워드·경쟁·상권 분석 초안을 생성한다. */
export async function generateConsulting(input: ConsultingInput): Promise<ConsultingResult> {
  const system =
    "당신은 한국 병원 마케팅 컨설턴트입니다. 병원 정보를 바탕으로 지역 기반 온라인 마케팅 컨설팅 초안을 작성합니다. " +
    "채널은 blog|place|powerlink|seo|geo|aeo 중에서 고릅니다. priority는 1(높음)~5(낮음). " +
    "반드시 이 JSON만 출력하세요: " +
    '{"coreKeywords": [{"keyword": string, "intent": string, "priority": number, "channel": string}], ' +
    '"competitorAnalysis": string, "marketAnalysis": string, "summary": string}. ' +
    "coreKeywords는 12~18개(지역명 결합·롱테일 포함). 분석은 한국어 3~6문장. " +
    "의료광고법상 과장·최상급·치료보장 표현은 사용하지 마세요.";
  const lines = [
    `병원명: ${input.hospitalName}`,
    input.address ? `주소: ${input.address}` : "",
    input.departments ? `진료과목: ${input.departments}` : "",
    input.competitors ? `경쟁 병원 후보: ${input.competitors}` : ""
  ].filter(Boolean);
  const res = await completeJson<ConsultingResult>(system, lines.join("\n"), 4000);
  return {
    coreKeywords: Array.isArray(res.coreKeywords)
      ? res.coreKeywords.slice(0, 30).map((k) => ({
          keyword: String(k.keyword ?? ""),
          intent: String(k.intent ?? ""),
          priority: Number.isFinite(k.priority) ? Math.min(5, Math.max(1, Math.round(k.priority))) : 3,
          channel: ["blog", "place", "powerlink", "seo", "geo", "aeo"].includes(String(k.channel)) ? String(k.channel) : "blog"
        })).filter((k) => k.keyword)
      : [],
    competitorAnalysis: String(res.competitorAnalysis ?? ""),
    marketAnalysis: String(res.marketAnalysis ?? ""),
    summary: String(res.summary ?? "")
  };
}

export type ContentPlanInput = { topic: string; keyword?: string | null; hospitalContext?: string | null; prohibited?: string | null };
export type ContentPlanDraft = { angle: string; faq: string[]; qa: { q: string; a: string }[] };

/** 콘텐츠 기획 — 주제·키워드로 콘텐츠 방향·FAQ·Q&A 초안을 생성한다(의료법 준수). */
export async function generateContentPlan(input: ContentPlanInput): Promise<ContentPlanDraft> {
  const system =
    "당신은 한국 병원 콘텐츠 기획자입니다. 주제로 블로그/콘텐츠 방향(angle), 자주 묻는 질문(FAQ), 환자 Q&A를 기획합니다. " +
    "반드시 이 JSON만 출력하세요: " +
    '{"angle": string, "faq": string[], "qa": [{"q": string, "a": string}]}. ' +
    "angle은 2~4문장, faq 5~8개, qa 4~6개. " +
    "의료광고법상 치료효과 보장·최상급(최고/유일)·완치·부작용 없음·비급여 할인 유인·후기성 표현은 절대 쓰지 마세요." +
    (input.prohibited ? ` 특히 다음 표현은 금지: ${input.prohibited}` : "");
  const lines = [
    `주제: ${input.topic}`,
    input.keyword ? `핵심 키워드: ${input.keyword}` : "",
    input.hospitalContext ? `병원 정보: ${input.hospitalContext}` : ""
  ].filter(Boolean);
  const res = await completeJson<ContentPlanDraft>(system, lines.join("\n"), 3000);
  return {
    angle: String(res.angle ?? ""),
    faq: Array.isArray(res.faq) ? res.faq.map(String).slice(0, 12) : [],
    qa: Array.isArray(res.qa) ? res.qa.slice(0, 10).map((x) => ({ q: String(x.q ?? ""), a: String(x.a ?? "") })).filter((x) => x.q) : []
  };
}

export type GeoAnswerInput = {
  question: string;
  hospitalName: string;
  department?: string | null;
  region?: string | null;
  strengths?: string | null;
  preferredTone?: string | null;
  prohibited?: string | null;
};
export type GeoAnswerDraft = {
  title: string;
  summary: string; // BLUF — 첫 문단 핵심 답변
  sections: { heading: string; body: string }[];
  faq: { q: string; a: string }[];
  caution: string; // 주의·상담 권고(의료법 안전장치)
};

/**
 * GEO 답변 페이지 초안 — 환자 질문에 대한 근거형(BLUF) 페이지를 생성한다.
 * AI 인용 최적화 원칙(채널 전략 보고서): 핵심 답변을 첫 문단에, 구조화된 소제목,
 * FAQ 병행, 효과 언급 시 주의·부작용 병기. 의료광고법 준수.
 */
export async function generateGeoAnswerPage(input: GeoAnswerInput): Promise<GeoAnswerDraft> {
  const system =
    "당신은 한국 병원의 의료 정보 콘텐츠 전문 작가입니다. 환자가 생성형 AI에 묻는 질문에 대해, " +
    "AI가 인용하기 좋은 근거형 답변 페이지 초안을 만듭니다. 규칙: " +
    "(1) BLUF — summary에 핵심 답변을 2~3문장으로 먼저 제시. " +
    "(2) sections는 소제목+본문 3~4개, 일반적 의학 정보 중심(특정 치료 권유 아님). " +
    "(3) faq는 연관 질문 3개(질문·답변 각 1~3문장). " +
    "(4) caution에는 '개인차가 있으며 정확한 진단은 의료진 상담이 필요하다'는 취지의 주의 문구. " +
    "(5) 의료광고법: 치료효과 보장·완치·최상급(최고/유일/1위)·부작용 없음·후기/체험담·할인/이벤트 표현 절대 금지. " +
    "(6) 병원 자랑이 아니라 환자에게 유용한 정보를 우선하고, 병원명은 자연스럽게 1~2회만. " +
    '반드시 이 JSON만 출력: {"title": string, "summary": string, "sections": [{"heading": string, "body": string}], "faq": [{"q": string, "a": string}], "caution": string}' +
    (input.prohibited ? ` 특히 다음 표현 금지: ${input.prohibited}` : "");
  const lines = [
    `환자 질문: ${input.question}`,
    `병원명: ${input.hospitalName}`,
    input.department ? `진료과: ${input.department}` : "",
    input.region ? `지역: ${input.region}` : "",
    input.strengths ? `병원 참고 정보(과장 없이 활용): ${input.strengths}` : "",
    input.preferredTone ? `톤앤매너: ${input.preferredTone}` : ""
  ].filter(Boolean);
  const res = await completeJson<GeoAnswerDraft>(system, lines.join("\n"), 4000);
  return {
    title: String(res.title ?? input.question),
    summary: String(res.summary ?? ""),
    sections: Array.isArray(res.sections)
      ? res.sections.slice(0, 6).map((s) => ({ heading: String(s.heading ?? ""), body: String(s.body ?? "") })).filter((s) => s.heading && s.body)
      : [],
    faq: Array.isArray(res.faq)
      ? res.faq.slice(0, 6).map((x) => ({ q: String(x.q ?? ""), a: String(x.a ?? "") })).filter((x) => x.q && x.a)
      : [],
    caution: String(res.caution ?? "증상과 치료 반응에는 개인차가 있으며, 정확한 진단과 치료 계획은 의료진과의 상담이 필요합니다.")
  };
}

export type MagazineDraftInput = { title: string; kind: string; category: string; seed?: string | null };
export type MagazineDraft = {
  title: string;
  summary: string; // BLUF — 첫 문단 핵심
  sections: { heading: string; body: string }[];
  related: string[]; // 연관 용어(내부링크 후보)
  faq: { q: string; a: string }[];
};

const MAGAZINE_KIND_GUIDE: Record<string, string> = {
  glossary: "용어사전 항목입니다. 정의를 명확히 하고, sections는 2~3개(정의·쉬운 설명·실무 포인트).",
  article: "인사이트 아티클입니다. sections 3~4개, 관점과 근거 중심으로.",
  howto: "실전 사용법입니다. sections를 단계(1단계·2단계…)로 구성.",
  news: "동향 해설입니다. 일반적으로 알려진 흐름만 설명하고, 특정 수치·날짜·출처를 지어내지 마세요."
};

/**
 * GROUND 매거진 초안 — 유형(용어사전/아티클/사용법/동향)에 맞춘 근거형(BLUF) 콘텐츠.
 * 자사 미디어(B2B)라 의료광고법 게이트는 없지만, 통계·수치를 지어내지 않는 원칙은 유지한다.
 */
export async function generateMagazineDraft(input: MagazineDraftInput): Promise<MagazineDraft> {
  const guide = MAGAZINE_KIND_GUIDE[input.kind] ?? MAGAZINE_KIND_GUIDE.article;
  const system =
    "당신은 SEO·GEO·AEO·AI마케팅 전문 매거진 'GROUND'의 에디터입니다. " +
    "독자는 마케터·업계인과 병원 담당자입니다. 쉽고 정확하게, 실무에 바로 쓰이게 씁니다. 규칙: " +
    "(1) BLUF — summary에 핵심 답을 1~2문장으로 먼저. " +
    "(2) " + guide + " " +
    "(3) related는 연관 용어/주제 3~5개(내부링크 후보). " +
    "(4) faq는 자주 묻는 질문 2~3개(질문·답변 각 1~2문장). " +
    "(5) 통계·수치·인용을 지어내지 마세요. 확실하지 않으면 일반적 표현으로. 과장·허위 금지. " +
    '반드시 이 JSON만 출력: {"title": string, "summary": string, "sections": [{"heading": string, "body": string}], "related": string[], "faq": [{"q": string, "a": string}]}';
  const lines = [
    `제목/용어: ${input.title}`,
    `카테고리: ${input.category}`,
    `유형: ${input.kind}`,
    input.seed ? `참고(정의/메모): ${input.seed}` : ""
  ].filter(Boolean);
  const res = await completeJson<MagazineDraft>(system, lines.join("\n"), 3500);
  return {
    title: String(res.title ?? input.title),
    summary: String(res.summary ?? ""),
    sections: Array.isArray(res.sections)
      ? res.sections.slice(0, 6).map((s) => ({ heading: String(s.heading ?? ""), body: String(s.body ?? "") })).filter((s) => s.heading && s.body)
      : [],
    related: Array.isArray(res.related) ? res.related.map(String).slice(0, 8).filter(Boolean) : [],
    faq: Array.isArray(res.faq)
      ? res.faq.slice(0, 6).map((x) => ({ q: String(x.q ?? ""), a: String(x.a ?? "") })).filter((x) => x.q && x.a)
      : []
  };
}
