// GEO Studio M3 — 저장된 콘텐츠 진단 조회.
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type SavedContentDiagnosis = {
  id: string;
  keyword: string;
  contentPreview: string;
  scoreTotal: number;
  rewrite: string;
  createdAt: Date;
};

/** 본인이 저장한 콘텐츠 진단 목록(최신순, 기본 10건). */
export async function listContentDiagnoses(user: CurrentUser, limit = 10): Promise<SavedContentDiagnosis[]> {
  return db.geoContentDiagnosis.findMany({
    where: { createdById: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, keyword: true, contentPreview: true, scoreTotal: true, rewrite: true, createdAt: true }
  });
}
