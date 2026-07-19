// GEO Studio P3b — 브랜드 검색지수 스냅샷 저장(폼 액션).
// 데이터랩은 6개월 롤링이라 저장해두지 않으면 과거 대비 불가 → 조회 시점 지수를 남긴다.
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/session";
import { getProvider } from "@/server/geo-studio/providers/resolver";
import { buildBrandTrendIndex } from "@/server/geo-studio/trend/brand-index";
import { getDefaultOrgId } from "@/server/org";
import { db } from "@/server/db";

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export type SnapshotSaveState = { ok: boolean; message: string } | null;

async function doSave(formData: FormData): Promise<SnapshotSaveState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "로그인이 필요합니다." };

  const brand = String(formData.get("brand") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!brand || !category) return { ok: false, message: "브랜드·카테고리를 먼저 조회하세요." };
  const competitors = csv(String(formData.get("competitors") ?? ""));

  const trend = await buildBrandTrendIndex(getProvider(), { brand, category, competitors });
  if (!trend.hasData) return { ok: false, message: "저장할 검색지수가 없습니다 — 데이터랩(네이버) 미연결이거나 데이터가 없습니다." };

  const orgId = await getDefaultOrgId();
  await db.trendSnapshot.createMany({
    data: trend.series.map((s) => ({
      orgId,
      brand,
      category,
      keyword: s.keyword,
      role: s.role,
      latestRatio: s.latest,
      points: s.points, // {period,value}[]
      capturedById: user.id
    }))
  });
  revalidatePath("/geo-cep");
  return { ok: true, message: `스냅샷 ${trend.series.length}건 저장됨 — 아래 이력에 반영됩니다.` };
}

/** 기존 void 폼 액션(호환 유지). */
export async function saveTrendSnapshot(formData: FormData): Promise<void> {
  await doSave(formData);
}

/** useActionState용 — 저장 결과(성공/실패 + 메시지)를 반환해 화면에 피드백. */
export async function saveTrendSnapshotState(_prev: SnapshotSaveState, formData: FormData): Promise<SnapshotSaveState> {
  try {
    return await doSave(formData);
  } catch {
    return { ok: false, message: "저장 중 오류가 발생했습니다." };
  }
}
