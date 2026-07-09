// 원고 스튜디오 "연관 키워드" 백엔드.
// studio.html → POST {keyword, region} · 응답 { ok, related[], questions[], volumes[], sources }
// 실제 검색량 API(네이버 검색광고)는 별도 키가 필요하므로, 여기서는 Claude로 연관/질문형
// 키워드를 제안한다(검색량 미포함). studio는 volumes가 비어도 후보 키워드를 표시한다.
import { NextResponse } from "next/server";

import { isAiConfigured, suggestKeywords } from "@/server/ai/claude";
import { hasEngineAccess } from "@/server/http/engine-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fail(error: string, status = 200) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  if (!(await hasEngineAccess(req))) {
    return fail("인증이 필요합니다. ERP에 로그인한 상태에서 이용하세요.", 401);
  }
  if (!isAiConfigured()) {
    return fail("AI가 아직 연결되지 않았습니다. ANTHROPIC_API_KEY를 등록하면 켜집니다.", 200);
  }

  let body: { keyword?: unknown; region?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("요청 형식이 올바르지 않습니다.", 400);
  }
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  const region = typeof body.region === "string" ? body.region : null;
  if (!keyword) return fail("핵심 키워드를 입력하세요.", 400);

  try {
    const { related, questions } = await suggestKeywords(keyword, region);
    return NextResponse.json({
      ok: true,
      related,
      questions,
      volumes: [], // 실제 검색량은 네이버 검색광고 키 연동 시 제공
      sources: { naver: 0, google: related.length, searchad: 0 }
    });
  } catch {
    return fail("키워드 조회 중 오류가 발생했습니다.", 200);
  }
}
