// 원고 스튜디오 "🪄 원고 생성하기" 백엔드.
// studio.html → POST {category, keyword, region, extra, target, tone, detail, withImage, save}
// 응답: { ok, post: { title, html, metaDesc, keywords, publishable, images, imageStatus } }
// 본문은 Claude(ANTHROPIC_API_KEY)로 생성, 이미지는 선택(withImage + OPENAI_API_KEY).
import { NextResponse } from "next/server";

import { generateBlogPost, isAiConfigured } from "@/server/ai/claude";
import { generateHeroImage } from "@/server/ai/image";
import { hasEngineAccess } from "@/server/http/engine-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function fail(error: string, status = 200) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  if (!(await hasEngineAccess(req))) {
    return fail("인증이 필요합니다. ERP에 로그인한 상태에서 이용하세요.", 401);
  }
  if (!isAiConfigured()) {
    return fail("AI가 아직 연결되지 않았습니다. 연동 화면에서 ANTHROPIC_API_KEY를 등록하면 켜집니다.", 200);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("요청 형식이 올바르지 않습니다.", 400);
  }
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword) return fail("핵심 키워드를 입력하세요.", 400);
  const str = (v: unknown) => (typeof v === "string" ? v : null);

  try {
    const post = await generateBlogPost({
      keyword,
      category: str(body.category),
      region: str(body.region),
      extra: str(body.extra),
      target: str(body.target),
      tone: str(body.tone),
      detail: str(body.detail)
    });

    // 이미지 생성은 선택. 실패해도 원고는 그대로 반환(치명적이지 않음).
    let images: string[] = [];
    let imageStatus = "미생성";
    if (body.withImage) {
      if (!process.env.OPENAI_API_KEY) {
        imageStatus = "OPENAI_API_KEY 미설정";
      } else {
        try {
          const dataUrl = await generateHeroImage(`${post.title} — ${keyword}`);
          if (dataUrl) {
            images = [dataUrl];
            imageStatus = "생성 완료";
          }
        } catch {
          imageStatus = "이미지 생성 실패(원고는 정상)";
        }
      }
    }

    return NextResponse.json({
      ok: true,
      post: { ...post, images, imageStatus }
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "UNKNOWN";
    if (raw === "AI_NOT_CONFIGURED") {
      return fail("AI가 아직 연결되지 않았습니다. ANTHROPIC_API_KEY를 등록하세요.", 200);
    }
    return fail("원고 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 200);
  }
}
