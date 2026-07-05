// 조직(테넌트) 해석 — 단일 회사 운용 기준. 첫 org를 기본 org로 사용하고, 없으면 생성한다.
// (P1: Organization 도입. 멀티 회사 확장 시 이 지점을 사용자/요청 컨텍스트 기반으로 교체.)
import { db } from "@/server/db";

let cachedOrgId: string | null = null;

/** 기본 조직 id를 반환. 없으면 생성(멱등, slug=venom 유니크). */
export async function getDefaultOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;

  const existing = await db.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  if (existing) {
    cachedOrgId = existing.id;
    return existing.id;
  }

  try {
    const created = await db.organization.create({ data: { name: "VENOM", slug: "venom" } });
    cachedOrgId = created.id;
    return created.id;
  } catch {
    // 동시 생성 경합(slug unique) → 재조회.
    const again = await db.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    if (again) {
      cachedOrgId = again.id;
      return again.id;
    }
    throw new Error("ORG_RESOLVE_FAILED");
  }
}
