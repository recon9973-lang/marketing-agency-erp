import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../guard";

export const dynamic = "force-dynamic";

// 네이버 지역(플레이스) 검색 — 병원명 실존·유사명칭 확인용
export async function GET(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  const q = req.nextUrl.searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ items: [] });

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ items: [], unconfigured: true });
  }

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`local ${res.status}`);
    const data = await res.json();
    const items = (data.items || []).map(
      (it: { title?: string; category?: string; address?: string; roadAddress?: string }) => ({
        title: String(it.title || "").replace(/<[^>]+>/g, "").trim(),
        category: String(it.category || ""),
        address: String(it.roadAddress || it.address || ""),
      })
    );
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 200 });
  }
}
