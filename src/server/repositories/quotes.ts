// 목표 경로: src/server/repositories/quotes.ts
//
// 견적 조회. 권한은 호출부(거래처 접근)에서 확인.
import { db } from "@/server/db";

export type QuoteItem = { productId: string | null; name: string; monthlyFee: number; quantity: number };
export type QuoteView = { id: string; tier: string; items: QuoteItem[]; monthlyTotal: number; status: string; createdAt: string };

const TIER_ORDER: Record<string, number> = { BASIC: 0, STANDARD: 1, PREMIUM: 2 };

/** 거래처 견적 목록(티어순). */
export async function listQuotes(clientId: string): Promise<QuoteView[]> {
  const rows = await db.quote.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } });
  return rows
    .map((q) => ({
      id: q.id,
      tier: q.tier,
      items: Array.isArray(q.items) ? (q.items as unknown as QuoteItem[]) : [],
      monthlyTotal: Number(q.monthlyTotal),
      status: q.status,
      createdAt: q.createdAt.toISOString()
    }))
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9));
}
