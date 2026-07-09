// 이미지 생성 엔진 — 원고 스튜디오(studio.html)의 "🖼️ 이미지 생성하기" 백엔드.
// studio.html은 같은 오리진의 /api/generate-image 로 POST {prompt, style, aspect} 를 보내고,
// { ok, dataUrl, mime, model } 응답을 기대한다(가려진 base64 data URL을 <img>에 그대로 표시).
//
// 이미지 생성은 Claude의 영역이 아니라 OpenAI 이미지 모델(gpt-image-1 / dall-e-3)을 사용한다.
// 규칙 유지: OPENAI_API_KEY 가 env에 있으면 켜지고, 없으면 안내 메시지를 돌려준다("키 넣으면 켜짐").
import { NextResponse } from "next/server";

import { generateImage } from "@/server/ai/image";
import { hasEngineAccess } from "@/server/http/engine-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 이미지 생성은 수십 초 걸릴 수 있어 서버리스 타임아웃을 넉넉히.
export const maxDuration = 60;

function fail(error: string, status = 200) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  if (!(await hasEngineAccess(req))) {
    return fail("인증이 필요합니다. ERP에 로그인한 상태에서 이용하세요.", 401);
  }
  if (!process.env.OPENAI_API_KEY) {
    return fail("이미지 엔진이 아직 연결되지 않았습니다. 연동 화면에서 OPENAI_API_KEY를 등록하면 켜집니다.", 200);
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

  try {
    const { dataUrl, mime, model } = await generateImage({ prompt, style, aspect });
    return NextResponse.json({ ok: true, dataUrl, mime, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "이미지 생성 중 오류가 발생했습니다.";
    return fail(msg, 200);
  }
}
