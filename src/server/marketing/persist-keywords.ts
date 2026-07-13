// src/server/marketing/persist-keywords.ts
//
// 키워드 저장 공용 헬퍼 — 기존 거래처 키워드와 중복을 메모리에서 제거하고 createMany로 일괄 저장.
// consulting(씨드 산출)·naver-keywords(연관 확장)가 같은 dedup+persist 로직을 쓰던 것을 통합.
import type { Prisma } from "@prisma/client";

export type KeywordRow = {
  keyword: string;
  intent?: string | null;
  searchVolume?: number | null;
  grade?: string | null;
  stage?: string | null;
  competition?: string | null;
  channel?: string;
  priority?: number;
};

type Tx = Pick<Prisma.TransactionClient, "keyword">;

/**
 * clientId의 기존 키워드와 중복을 제거하고 신규만 createMany로 저장한다(공백 무시 정규화 dedup).
 * @returns 실제 저장된 신규 키워드 수.
 */
export async function persistKeywords(
  tx: Tx,
  clientId: string,
  orgId: string | null,
  rows: KeywordRow[]
): Promise<number> {
  const existing = new Set(
    (await tx.keyword.findMany({ where: { clientId }, select: { keyword: true } })).map((k) =>
      k.keyword.replace(/\s+/g, "")
    )
  );
  const data: Prisma.KeywordCreateManyInput[] = [];
  for (const r of rows) {
    const norm = r.keyword.replace(/\s+/g, "");
    if (!norm || existing.has(norm)) continue;
    existing.add(norm);
    data.push({
      clientId,
      keyword: r.keyword,
      intent: r.intent ?? null,
      searchVolume: r.searchVolume ?? null,
      grade: r.grade ?? null,
      stage: r.stage ?? null,
      competition: r.competition ?? null,
      channel: r.channel ?? "blog",
      priority: r.priority ?? 3,
      orgId
    });
  }
  if (data.length) await tx.keyword.createMany({ data, skipDuplicates: true });
  return data.length;
}
