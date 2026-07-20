"use server";

// GEO 키워드 단계 — 시드(메인+서브)에서 연관키워드(네이버 SearchAd 실측) 추출 →
// 검색량 30 이상만 선별 → 저장. 선택 키워드가 이후 단계(질문/CEP/여정/콘텐츠)로 이어진다.
import { z } from "zod";

import { db } from "@/server/db";
import { fetchRelatedKeywords, naverSearchConfigured } from "@/server/integrations/naver-search";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";

const MIN_VOLUME = 30; // 오더: 검색량 30 이상만 채택

// 테이블 자가치유 — 마이그레이션 지연 DB에서도 저장되게(멱등).
async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "GeoKeyword" ("id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "term" TEXT NOT NULL, "volume" INTEGER, "source" TEXT NOT NULL DEFAULT 'RELATED', "selected" BOOLEAN NOT NULL DEFAULT false, "orgId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "GeoKeyword_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "GeoKeyword_clientId_term_key" ON "GeoKeyword" ("clientId", "term")`
    );
  } catch (e) {
    console.warn("[geo-keywords] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

/** 시드에서 연관키워드 추출 → 검색량≥30 선별 → 저장. configured=false면 데모/미측정. */
export async function extractGeoKeywords(input: unknown): Promise<ActionResult<{ added: number; configured: boolean }>> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ clientId: z.string().min(1), seeds: z.array(z.string()).min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const clientId = p.data.clientId;
    const seeds = [...new Set(p.data.seeds.map((s) => s.trim()).filter(Boolean))].slice(0, 5);
    if (seeds.length === 0) throw new Error("VALIDATION");

    await ensureTable();
    const configured = naverSearchConfigured();

    // 시드 저장(SEED·자동 채택)
    for (const term of seeds) {
      await db.geoKeyword
        .upsert({
          where: { clientId_term: { clientId, term } },
          update: { source: "SEED", selected: true },
          create: { clientId, term, source: "SEED", selected: true }
        })
        .catch(() => undefined);
    }

    // 연관어 추출 + ≥30 필터 저장
    let added = 0;
    for (const seed of seeds) {
      const related = await fetchRelatedKeywords(seed, 100).catch(() => []);
      const filtered = related.filter((r) => (r.total ?? 0) >= MIN_VOLUME);
      for (const r of filtered) {
        const term = r.keyword.trim();
        if (!term || seeds.includes(term)) continue;
        const res = await db.geoKeyword
          .upsert({
            where: { clientId_term: { clientId, term } },
            update: { volume: r.total ?? undefined },
            create: { clientId, term, volume: r.total ?? null, source: "RELATED", selected: false }
          })
          .catch(() => null);
        if (res) added += 1;
      }
    }
    return { added, configured };
  });
}

/** 키워드 채택/해제. */
export async function toggleGeoKeyword(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1), selected: z.boolean() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.geoKeyword.update({ where: { id: p.data.id }, data: { selected: p.data.selected } });
  });
}

/** 키워드 삭제. */
export async function removeGeoKeyword(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.geoKeyword.delete({ where: { id: p.data.id } });
  });
}
