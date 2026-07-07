// AI 마케팅 엔진의 Claude 호출부.
// 규칙: ANTHROPIC_API_KEY 가 env에 있으면 켜지고, 없으면 isAiConfigured()=false.
// 공식 SDK(@anthropic-ai/sdk) 사용. 모델 기본값 claude-opus-4-8 + adaptive thinking,
// 긴 출력을 대비해 stream() 후 finalMessage()로 완성본을 받는다.
import Anthropic from "@anthropic-ai/sdk";

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
