// 이미지 생성 엔진 — 원고 스튜디오(studio.html)의 "🖼️ 이미지 생성하기" 백엔드.
// studio.html은 같은 오리진의 /api/generate-image 로 POST {prompt, style, aspect} 를 보내고,
// { ok, dataUrl, mime, model } 응답을 기대한다(가려진 base64 data URL을 <img>에 그대로 표시).
//
// 이미지 생성은 Claude의 영역이 아니라 OpenAI 이미지 모델(gpt-image-1 / dall-e-3)을 사용한다.
// 규칙 유지: OPENAI_API_KEY 가 env에 있으면 켜지고, 없으면 안내 메시지를 돌려준다("키 넣으면 켜짐").
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 이미지 생성은 수십 초 걸릴 수 있어 서버리스 타임아웃을 넉넉히.
export const maxDuration = 60;

const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";

// studio.html의 스타일 코드 → 프롬프트에 덧붙일 묘사.
const STYLE_HINT: Record<string, string> = {
  photo: "사실적인 고품질 사진, 자연광",
  illustration: "깔끔한 플랫 일러스트레이션, 부드러운 색감",
  thumbnail: "시선을 끄는 유튜브 썸네일 스타일, 강한 대비와 굵은 구도",
  card: "카드뉴스용 그래픽, 여백이 있는 심플한 레이아웃, 텍스트 오버레이 여지",
  render3d: "부드러운 3D 렌더, 은은한 그림자와 입체감"
};

// 모델별 지원 사이즈. gpt-image-1: 1024²/1536×1024/1024×1536, dall-e-3: 1024²/1792×1024/1024×1792.
function sizeFor(model: string, aspect: string): string {
  const isDalle = model.startsWith("dall-e");
  if (aspect === "wide") return isDalle ? "1792x1024" : "1536x1024";
  if (aspect === "tall") return isDalle ? "1024x1792" : "1024x1536";
  return "1024x1024"; // square 기본
}

function timingSafeEqual256(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function fail(error: string, status = 200) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  // 인증: 로그인한 ERP 사용자면 통과(스튜디오는 같은 오리진에서 세션 쿠키를 보낸다).
  // 외부 엔진처럼 쓰는 경우엔 ADMIN_SECRET 를 Bearer 로 받는다(설정돼 있을 때만).
  const user = await getCurrentUser().catch(() => null);
  const adminSecret = process.env.ADMIN_SECRET;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const bearerOk = Boolean(adminSecret && bearer && timingSafeEqual256(bearer, adminSecret));
  if (!user && !bearerOk) {
    return fail("인증이 필요합니다. ERP에 로그인한 상태에서 이용하세요.", 401);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fail(
      "이미지 엔진이 아직 연결되지 않았습니다. 연동 화면에서 OPENAI_API_KEY를 등록하면 켜집니다.",
      200
    );
  }

  let body: { prompt?: unknown; style?: unknown; aspect?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("요청 형식이 올바르지 않습니다.", 400);
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const style = typeof body.style === "string" ? body.style : "photo";
  const aspect = typeof body.aspect === "string" ? body.aspect : "square";
  if (!prompt) return fail("이미지 프롬프트를 입력하세요.", 400);
  if (prompt.length > 4000) return fail("프롬프트가 너무 깁니다.", 400);

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const isDalle = model.startsWith("dall-e");
  const hint = STYLE_HINT[style] ?? STYLE_HINT.photo;
  const finalPrompt = `${prompt}\n\n스타일: ${hint}. 한국 마케팅 콘텐츠에 어울리는 이미지. 텍스트/글자는 넣지 마세요.`;

  const payload: Record<string, unknown> = {
    model,
    prompt: finalPrompt,
    size: sizeFor(model, aspect),
    n: 1
  };
  // dall-e-3는 base64를 받으려면 response_format 지정이 필요하고, gpt-image-1은 항상 base64(지정 시 에러).
  if (isDalle) payload.response_format = "b64_json";

  try {
    const res = await fetch(OPENAI_IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = (await res.json().catch(() => null)) as
      | { data?: Array<{ b64_json?: string }>; error?: { message?: string } }
      | null;

    if (!res.ok) {
      const msg = data?.error?.message || `이미지 엔진 오류 (HTTP ${res.status})`;
      return fail(msg, 200);
    }
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return fail("이미지 데이터를 받지 못했습니다.", 200);

    return NextResponse.json({
      ok: true,
      mime: "image/png",
      dataUrl: `data:image/png;base64,${b64}`,
      model
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "이미지 생성 중 오류가 발생했습니다.";
    return fail(msg, 200);
  }
}
