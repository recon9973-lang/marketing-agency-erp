import type { ReactNode } from "react";
import { guardFeature } from "@/server/feature-guard";

// 근태/인사(연차·휴가) 기능 접근 가드 — 차단된 사용자는 대시보드로.
export default async function LeaveLayout({ children }: { children: ReactNode }) {
  await guardFeature("leave");
  return <>{children}</>;
}
