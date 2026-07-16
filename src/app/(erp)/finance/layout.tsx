import type { ReactNode } from "react";
import { guardFeature } from "@/server/feature-guard";

// 재무 기능 접근 가드 — 차단된 사용자는 대시보드로. 하위 경로까지 보호.
export default async function FinanceLayout({ children }: { children: ReactNode }) {
  await guardFeature("finance");
  return <>{children}</>;
}
