import type { ReactNode } from "react";
import { guardFeature } from "@/server/feature-guard";

// 기능 접근 가드 — 차단된 사용자는 대시보드로. 하위 경로까지 보호.
export default async function FeatureLayout({ children }: { children: ReactNode }) {
  await guardFeature("keywords");
  return <>{children}</>;
}
