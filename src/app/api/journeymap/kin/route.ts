import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../guard";

export const dynamic = "force-dynamic";

// 네이버 지식iN 질문 수집 (오픈API search/kin)
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
    const url = `https://openapi.naver.com/v1/search/kin.json?query=${encodeURIComponent(q)}&display=10&sort=sim`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`kin ${res.status}`);
    const data = await res.json();
    const items: string[] = (data.items || [])
      .map((it: { title?: string }) =>
        String(it.title || "")
          .replace(/<[^>]+>/g, "")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/[?？!.]+$/g, "")
          .trim()
      )
      .filter((t: string) => t.length >= 4 && t.length <= 40);
    return NextResponse.json({ items: Array.from(new Set(items)).slice(0, 8) });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 200 });
  }
}
