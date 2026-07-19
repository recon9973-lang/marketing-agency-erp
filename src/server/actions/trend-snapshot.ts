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

export async function saveTrendSnapshot(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const brand = String(formData.get("brand") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!brand || !category) return;
  const competitors = csv(String(formData.get("competitors") ?? ""));

  const trend = await buildBrandTrendIndex(getProvider(), { brand, category, competitors });
  if (!trend.hasData) return;

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
}
