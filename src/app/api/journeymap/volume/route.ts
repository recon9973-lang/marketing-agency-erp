import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../guard";

export const dynamic = "force-dynamic";

// 네이버 검색광고 API — 월간 검색량·경쟁도(keywordstool) + 모바일 예상 입찰가(CPC)
// 필요 환경변수: NAVER_AD_API_KEY, NAVER_AD_SECRET(또는 NAVER_AD_SECRET_KEY), NAVER_AD_CUSTOMER_ID
const BASE = "https://api.searchad.naver.com";

function signedHeaders(method: string, uri: string, apiKey: string, secret: string, customerId: string) {
  const timestamp = String(Date.now());
  const sig = crypto.createHmac("sha256", secret).update(`${timestamp}.${method}.${uri}`).digest("base64");
  return {
    "X-Timestamp": timestamp,
    "X-API-KEY": apiKey,
    "X-Customer": customerId,
    "X-Signature": sig,
    "Content-Type": "application/json; charset=UTF-8",
  };
}

function parseCount(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) ? n : null; // "< 10" → 10
  }
  return null;
}

const COMP_LABEL: Record<string, string> = { 낮음: "낮음", 중간: "중간", 높음: "높음", low: "낮음", mid: "중간", high: "높음" };

// POST body: { keywords: string[] (최대 5개) }
export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  const apiKey = process.env.NAVER_AD_API_KEY;
  const secret = process.env.NAVER_AD_SECRET ?? process.env.NAVER_AD_SECRET_KEY;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID;
  if (!apiKey || !secret || !customerId) {
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

  try {
    // 1) keywordstool: 월간 검색량 + 경쟁도 (hintKeywords 최대 5개, 공백 제거 필요)
    const hint = keywords.map((k) => k.replace(/\s+/g, "")).join(",");
    const uri = "/keywordstool";
    const res = await fetch(`${BASE}${uri}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`, {
      headers: signedHeaders("GET", uri, apiKey, secret, customerId),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`keywordstool ${res.status}`);
    const data = await res.json();

    const results: Record<string, { volumePc: number | null; volumeMo: number | null; competition: string | null; cpc: number | null }> = {};
    const wanted = new Map(keywords.map((k) => [k.replace(/\s+/g, "").toLowerCase(), k]));
    const related: { keyword: string; volumePc: number | null; volumeMo: number | null; competition: string | null }[] = [];
    for (const item of data.keywordList || []) {
      const relRaw = String(item.relKeyword || "");
      const rel = relRaw.toLowerCase();
      const orig = wanted.get(rel);
      if (orig) {
        results[orig] = {
          volumePc: parseCount(item.monthlyPcQcCnt),
          volumeMo: parseCount(item.monthlyMobileQcCnt),
          competition: COMP_LABEL[String(item.compIdx)] ?? String(item.compIdx ?? "") ?? null,
          cpc: null,
        };
      } else if (includeRelated && relRaw) {
        // 검색광고가 함께 반환하는 연관키워드 — 검색량 포함
        related.push({
          keyword: relRaw,
          volumePc: parseCount(item.monthlyPcQcCnt),
          volumeMo: parseCount(item.monthlyMobileQcCnt),
          competition: COMP_LABEL[String(item.compIdx)] ?? String(item.compIdx ?? "") ?? null,
        });
      }
    }
    related.sort((a, b) => (b.volumePc ?? 0) + (b.volumeMo ?? 0) - ((a.volumePc ?? 0) + (a.volumeMo ?? 0)));

    // 2) 모바일 1위 예상 입찰가 → CPC 근사치 (실패해도 검색량은 반환)
    try {
      const bidUri = "/estimate/average-position-bid/keyword";
      const bidRes = await fetch(`${BASE}${bidUri}`, {
        method: "POST",
        headers: signedHeaders("POST", bidUri, apiKey, secret, customerId),
        body: JSON.stringify({
          device: "MOBILE",
          items: keywords.map((k) => ({ key: k.replace(/\s+/g, ""), position: 1 })),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (bidRes.ok) {
        const bidData = await bidRes.json();
        for (const est of bidData.estimate || []) {
          const orig = wanted.get(String(est.keyword || "").toLowerCase());
          if (orig && results[orig]) results[orig].cpc = typeof est.bid === "number" ? est.bid : null;
        }
      }
    } catch {
      /* CPC 실패 무시 */
    }

    return NextResponse.json({ results, related: includeRelated ? related.slice(0, 120) : undefined });
  } catch (e) {
    return NextResponse.json({ results: {}, error: String(e) }, { status: 200 });
  }
}
