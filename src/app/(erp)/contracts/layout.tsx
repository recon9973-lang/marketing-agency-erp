import type { ReactNode } from "react";
import { guardFeature } from "@/server/feature-guard";

// 계약서 기능 접근 가드 — 차단된 사용자는 대시보드로. 목록·상세 모두 보호.
export default async function ContractsLayout({ children }: { children: ReactNode }) {
  await guardFeature("contracts");
  return <>{children}</>;
}
