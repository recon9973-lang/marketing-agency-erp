// GEO 학습 모델 버전 리포지토리 — 버전 목록·활성 버전·다음 번호. 권한은 호출부에서 확인.
import { db } from "@/server/db";
import type { LearnedWeight } from "@/domain/geo/learning";

export async function getActiveModelVersion(orgId: string | null) {
  return db.geoModelVersion.findFirst({
    where: { orgId, status: "ACTIVE" },
    orderBy: { version: "desc" }
  });
}

/** 현재 활성 가중치(없으면 빈 배열). 전략 추천이 이 가중치를 참조. */
export async function getActiveWeights(orgId: string | null): Promise<LearnedWeight[]> {
  const active = await getActiveModelVersion(orgId);
  return active ? ((active.weights as unknown as LearnedWeight[]) ?? []) : [];
}

export async function listModelVersions(orgId: string | null) {
  return db.geoModelVersion.findMany({ where: { orgId }, orderBy: { version: "desc" } });
}

export async function nextVersionNumber(orgId: string | null): Promise<number> {
  const last = await db.geoModelVersion.findFirst({
    where: { orgId },
    orderBy: { version: "desc" },
    select: { version: true }
  });
  return (last?.version ?? 0) + 1;
}
