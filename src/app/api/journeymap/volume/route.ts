import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../guard";
import { fetchBidEstimates, fetchKeywordExpansion, naverSearchConfigured } from "@/server/integrations/naver-search";

export const dynamic = "force-dynamic";

// 네이버 검색광고 — 월간 검색량·경쟁도(keywordstool) + 모바일 1위 예상 입찰가(CPC).
// HMAC 서명·응답 파싱은 naver-search.ts 공용 모듈로 통일(이중 구현 제거).
// 여정맵은 실측 원칙: 미연동이거나 API 실패로 추정치(estimated)만 온 경우 데이터를 지어내지 않는다.

// POST body: { keywords: string[] (최대 5개), includeRelated?: boolean }
export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  if (!naverSearchConfigured()) {
    return NextResponse.json({ unconfigured: true, results: {} });
  }

  let keywords: string[] = [];
  let includeRelated = false;
  try {
    const body = await req.json();
    keywords = (body.keywords || []).slice(0, 5).map((k: string) => k.trim()).filter(Boolean);
    includeRelated = !!body.includeRelated;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (keywords.length === 0) return NextResponse.json({ results: {} });

  const { rows } = await fetchKeywordExpansion(keywords, includeRelated ? 120 : 0);
  const wanted = new Map(keywords.map((k) => [k.replace(/\s+/g, "").toLowerCase(), k]));
  const results: Record<string, { volumePc: number | null; volumeMo: number | null; competition: string | null; cpc: number | null }> = {};
  const related: { keyword: string; volumePc: number | null; volumeMo: number | null; competition: string | null }[] = [];
  for (const r of rows) {
    if (r.estimated) continue; // 데모 추정치는 여정맵에 싣지 않는다(실측 원칙)
    const orig = wanted.get(r.keyword.replace(/\s+/g, "").toLowerCase());
    if (orig && !r.related) {
      results[orig] = { volumePc: r.pc, volumeMo: r.mobile, competition: r.competition, cpc: null };
    } else if (includeRelated && r.related) {
      related.push({ keyword: r.keyword, volumePc: r.pc, volumeMo: r.mobile, competition: r.competition });
    }
  }

  // 조회는 성공했는데 응답에 행이 없는 키워드 = 네이버 집계상 검색량이 사실상 0인 키워드.
  // "-"(미조회)와 구분하기 위해 0으로 명시한다. (API 실패/추정치뿐인 경우는 채우지 않음)
  const anyReal = rows.some((r) => !r.estimated);
  if (anyReal) {
    for (const orig of keywords) {
      if (!results[orig]) results[orig] = { volumePc: 0, volumeMo: 0, competition: null, cpc: null };
    }
  }

  // 모바일 1위 예상 입찰가 → CPC 근사치(실패해도 검색량은 반환)
  const bids = await fetchBidEstimates(keywords.map((k) => k.replace(/\s+/g, "")), "MOBILE", 1);
  for (const [key, bid] of bids) {
    const orig = wanted.get(key.toLowerCase());
    if (orig && results[orig]) results[orig].cpc = bid;
  }

  return NextResponse.json({ results, related: includeRelated ? related : undefined });
}
