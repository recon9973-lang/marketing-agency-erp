// 기능 단위 접근 가드 — 차단된 사용자가 URL로 직접 들어와도 대시보드로 돌려보낸다.
// 각 기능 라우트의 layout.tsx에서 호출해 목록·상세 하위 경로까지 한 번에 보호한다.
import "server-only";
import { redirect } from "next/navigation";
import { canUseFeature, type FeatureKey } from "@/domain/features";
import { getCurrentUser } from "@/server/session";

export async function guardFeature(key: FeatureKey) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canUseFeature(user.role, user.deniedFeatures, key)) redirect("/dashboard");
  return user;
}
