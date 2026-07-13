// 브랜드킷 조회 — 조직/거래처별 로고·컬러·폰트. 쓰기는 actions/brand-kits.ts.
import { db } from "@/server/db";

export type BrandKitItem = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  colors: string[];
  fontFamily: string | null;
};

function parseColors(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((c): c is string => typeof c === "string") : [];
}

export async function listBrandKits(orgId: string): Promise<BrandKitItem[]> {
  const rows = await db.brandKit.findMany({ where: { orgId }, orderBy: { updatedAt: "desc" } });
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter((x): x is string => Boolean(x)))];
  const clients = clientIds.length
    ? await db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(clients.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    clientId: r.clientId,
    clientName: r.clientId ? nameById.get(r.clientId) ?? null : null,
    colors: parseColors(r.colors),
    fontFamily: r.fontFamily
  }));
}

/** 에디터에 넘길 브랜드 색 팔레트(조직의 브랜드킷 색을 취합, 최대 12색). */
export async function brandColorsForOrg(orgId: string, clientId?: string | null): Promise<string[]> {
  const rows = await db.brandKit.findMany({
    where: { orgId, ...(clientId ? { OR: [{ clientId }, { clientId: null }] } : {}) },
    orderBy: [{ clientId: "desc" }, { updatedAt: "desc" }],
    take: 6
  });
  const set = new Set<string>();
  for (const r of rows) for (const c of parseColors(r.colors)) set.add(c);
  return [...set].slice(0, 12);
}
