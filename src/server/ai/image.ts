// 이미지 생성 공통부 — OpenAI 이미지 모델(gpt-image-1 기본, OPENAI_IMAGE_MODEL 로 교체).
// 규칙 유지: OPENAI_API_KEY 있으면 켜짐. 이미지는 Claude 영역이 아니라 OpenAI 사용.
const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";

export function isImageConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// studio.html 스타일 코드 → 프롬프트 묘사.
const STYLE_HINT: Record<string, string> = {
  photo: "사실적인 고품질 사진, 자연광",
  illustration: "깔끔한 플랫 일러스트레이션, 부드러운 색감",
  thumbnail: "시선을 끄는 유튜브 썸네일 스타일, 강한 대비와 굵은 구도",
  card: "카드뉴스용 그래픽, 여백이 있는 심플한 레이아웃, 텍스트 오버레이 여지",
  render3d: "부드러운 3D 렌더, 은은한 그림자와 입체감"
};

// 모델별 지원 사이즈.
function sizeFor(model: string, aspect: string): string {
  const isDalle = model.startsWith("dall-e");
  if (aspect === "wide") return isDalle ? "1792x1024" : "1536x1024";
  if (aspect === "tall") return isDalle ? "1024x1792" : "1024x1536";
  return "1024x1024";
}

export type ImageResult = { dataUrl: string; mime: string; model: string };

/**
 * 이미지 1장 생성 → data URL 반환. 키 없으면 AI_NOT_CONFIGURED, 실패 시 원본 에러 메시지 throw.
 */
export async function generateImage(opts: {
  prompt: string;
  style?: string;
  aspect?: string;
}): Promise<ImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("IMAGE_NOT_CONFIGURED");

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const isDalle = model.startsWith("dall-e");
  const hint = STYLE_HINT[opts.style ?? "photo"] ?? STYLE_HINT.photo;
  const finalPrompt = `${opts.prompt}\n\n스타일: ${hint}. 한국 마케팅 콘텐츠에 어울리는 이미지. 텍스트/글자는 넣지 마세요.`;

  const payload: Record<string, unknown> = {
    model,
    prompt: finalPrompt,
    size: sizeFor(model, opts.aspect ?? "square"),
    n: 1
  };
  if (isDalle) payload.response_format = "b64_json";

  const res = await fetch(OPENAI_IMAGE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
  const data = (await res.json().catch(() => null)) as
    | { data?: Array<{ b64_json?: string }>; error?: { message?: string } }
    | null;

  if (!res.ok) throw new Error(data?.error?.message || `이미지 엔진 오류 (HTTP ${res.status})`);
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("이미지 데이터를 받지 못했습니다.");

  return { dataUrl: `data:image/png;base64,${b64}`, mime: "image/png", model };
}

/** 블로그 대표 이미지용 간편 래퍼. 실패해도 상위에서 무시하기 쉽게 null 반환 안 하고 던진다. */
export async function generateHeroImage(prompt: string): Promise<string> {
  const { dataUrl } = await generateImage({ prompt, style: "photo", aspect: "wide" });
  return dataUrl;
}
