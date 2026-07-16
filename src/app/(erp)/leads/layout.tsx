import type { ReactNode } from "react";
import { guardFeature } from "@/server/feature-guard";

// 영업 리드 기능 접근 가드 — 차단된 사용자는 대시보드로. 목록·상세 모두 보호.
export default async function LeadsLayout({ children }: { children: ReactNode }) {
  await guardFeature("leads");
  return <>{children}</>;
}
