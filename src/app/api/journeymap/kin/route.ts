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
    const seen = new Set<string>();
    const items: { title: string; link: string }[] = [];
    for (const it of data.items || []) {
      const title = String(it.title || "")
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[?？!.]+$/g, "")
        .trim();
      if (title.length < 4 || title.length > 40 || seen.has(title)) continue;
      seen.add(title);
      items.push({ title, link: String(it.link || "") });
      if (items.length >= 8) break;
    }
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 200 });
  }
}
