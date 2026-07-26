import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../guard";

export const dynamic = "force-dynamic";

// 네이버·구글 자동완성 프록시 (브라우저 CORS 우회)
export async function GET(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  const q = req.nextUrl.searchParams.get("q") || "";
  const source = req.nextUrl.searchParams.get("source") || "naver";
  if (!q.trim()) return NextResponse.json({ items: [] });

  try {
    if (source === "naver") {
      const url = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(
        q
      )}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.naver.com/" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`naver ${res.status}`);
      const data = await res.json();
      const items: string[] = [];
      for (const group of data.items || []) {
        for (const entry of group || []) {
          const kw = Array.isArray(entry) ? entry[0] : entry;
          if (typeof kw === "string" && kw.trim()) items.push(kw.trim());
        }
      }
      return NextResponse.json({ items: Array.from(new Set(items)).slice(0, 10) });
    }

    if (source === "google") {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`google ${res.status}`);
      const buf = await res.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(buf);
      const data = JSON.parse(text);
      const items: string[] = (data[1] || []).filter((s: unknown) => typeof s === "string");
      return NextResponse.json({ items: Array.from(new Set(items)).slice(0, 10) });
    }

    return NextResponse.json({ items: [] });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 200 });
  }
}
