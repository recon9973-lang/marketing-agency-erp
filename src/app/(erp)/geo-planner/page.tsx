// GEO 캠페인 플래너 — GEO Studio M5(채널 실행 플래너) 화면.
// 목표·현재상태·업종·예산 → 채널 믹스·태스크·ROI·KPI·리포트를 즉시 계산(DB 미저장, 후속 배선).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeoPlannerForm } from "@/components/geo-planner/GeoPlannerForm";
import { getCurrentUser } from "@/server/session";

export default async function GeoPlannerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="GEO Studio · M5"
        title="GEO 캠페인 플래너"
        description="GEO 목표를 실행 캠페인으로 전환합니다. 목표·현재 지표·업종·예산을 넣으면 채널 믹스·실행 태스크·ROI·KPI 진척과 경영진 리포트를 즉시 산출합니다."
      />
      <GeoPlannerForm />
    </section>
  );
}
