import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Role } from "@/domain/types";
import { guardFeature } from "@/server/feature-guard";

// 재무 기능 접근 가드 — 차단된 사용자·마케터는 대시보드로. 하위 경로까지 보호.
// (재무는 SUPER_ADMIN·ADMIN 전용 — nav 숨김과 동일한 역할 정책을 URL 직접진입에도 적용.)
export default async function FinanceLayout({ children }: { children: ReactNode }) {
  const user = await guardFeature("finance");
  if (user.role === Role.MARKETER) redirect("/dashboard");
  return <>{children}</>;
}
