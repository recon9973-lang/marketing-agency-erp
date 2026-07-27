import type { ReactNode } from "react";
import { guardFeature } from "@/server/feature-guard";

// 모니터링은 GEO 기능 차단을 그대로 따른다.
export default async function FeatureLayout({ children }: { children: ReactNode }) {
  await guardFeature("geo");
  return <>{children}</>;
}
