import { NextRequest, NextResponse } from "next/server";
import { fetchKeywordTrends, naverDatalabConfigured } from "@/server/integrations/naver-datalab";
import { normalizeQuery, parseRegion } from "@/lib/journeymap/region";
import { requireStaff } from "../../guard";

export const dynamic = "force-dynamic";

// 지역 조합 추천 — 기존 데이터랩 어댑터로 상대 검색 추이를 비교해 우선순위를 매긴다.
// 데이터랩은 절대 검색량이 아닌 상대 추이이므로 비교 용도로만 쓴다.

export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  if (!naverDatalabConfigured()) {
    return NextResponse.json({ error: "네이버 오픈API 키가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const query = normalizeQuery(String(body.query || ""));
    if (!query) return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });

    const { region, topic } = parseRegion(query);
    if (!topic) {
      return NextResponse.json(
        { error: "시술·주제가 없는 키워드입니다. '대구 임플란트'처럼 입력하세요." },
        { status: 400 }
      );
    }

    // 조합: 전체 지역+주제, 지역 토큰별+주제, 주제 단독(전국 기준선) — 데이터랩 한도 5개
    const candidates: string[] = [];
    if (region) {
      candidates.push(`${region} ${topic}`);
      for (const token of region.split(" ")) candidates.push(`${token} ${topic}`);
    }
    candidates.push(topic);
    const combos = Array.from(new Set(candidates)).slice(0, 5);

    const trends = await fetchKeywordTrends(combos);
    const ranked = trends
      .map((t) => {
        const ratios = t.points.map((p) => p.ratio);
        const score =
          ratios.length > 0 ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 10) / 10 : 0;
        return { query: t.keyword, score, latestRatio: t.latestRatio, delta: t.delta };
      })
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({ combos: ranked });
  } catch (err) {
    console.error("조합 추천 오류:", err);
    return NextResponse.json({ error: "지역 조합 추천 중 오류가 발생했습니다." }, { status: 500 });
  }
}
