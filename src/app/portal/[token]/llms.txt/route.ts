import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { buildClientLlmsTxt } from "@/server/geo-engine/llms-txt-client";

// 공개 llms.txt 서빙(#20) — 로그인 없이 portalToken으로만 거래처를 특정한다.
// AI 크롤러/에이전트가 직접 fetch 하거나, 병원이 자기 사이트 루트(/llms.txt)로 프록시·복사할 수 있다.
// 노출은 게시된(publishedUrl) 답변 페이지 링크뿐 — 내부 데이터는 포함하지 않는다.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return new NextResponse("Not found", { status: 404 });

  const client = await db.client.findUnique({ where: { portalToken: token }, select: { id: true } });
  if (!client) return new NextResponse("Not found", { status: 404 });

  const llms = await buildClientLlmsTxt(client.id);
  if (!llms) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(llms.text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // 크롤러 캐시 여유 + 재검증(1시간).
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
}
