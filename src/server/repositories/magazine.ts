// 목표 경로: src/server/repositories/magazine.ts
//
// GROUND 매거진 큐 조회 — 상태·카테고리 필터 + 요약 집계.
import { db } from "@/server/db";

export type MagazineRow = {
  id: string;
  title: string;
  category: string;
  kind: string;
  seed: string | null;
  status: string;
  draft: string | null;
  publishedUrl: string | null;
  scheduledAt: string | null;
  createdAt: string;
};

export async function listMagazineQueue(filter?: { status?: string; category?: string }): Promise<MagazineRow[]> {
  const rows = await db.magazinePost.findMany({
    where: {
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.category ? { category: filter.category } : {})
    },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
    select: { id: true, title: true, category: true, kind: true, seed: true, status: true, draft: true, publishedUrl: true, scheduledAt: true, createdAt: true }
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    kind: r.kind,
    seed: r.seed,
    status: r.status,
    draft: r.draft,
    publishedUrl: r.publishedUrl,
    scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
    createdAt: r.createdAt.toISOString()
  }));
}

export type MagazineSummary = { total: number; queued: number; drafted: number; reviewed: number; published: number };

export async function magazineSummary(): Promise<MagazineSummary> {
  const grouped = await db.magazinePost.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []);
  const by = new Map<string, number>();
  for (const g of grouped) by.set(g.status, g._count._all);
  return {
    total: [...by.values()].reduce((a, b) => a + b, 0),
    queued: by.get("QUEUED") ?? 0,
    drafted: by.get("DRAFTED") ?? 0,
    reviewed: by.get("REVIEWED") ?? 0,
    published: by.get("PUBLISHED") ?? 0
  };
}
