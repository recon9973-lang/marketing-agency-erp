// GEO 캠페인 플래너 — GEO Studio M5(채널 실행 플래너) 화면.
// 목표·현재상태·업종·예산 → 채널 믹스·태스크·ROI·KPI·리포트를 즉시 계산(DB 미저장, 후속 배선).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
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

      {/* 데이터 연결 상태 — 채널 믹스·ROI는 추정 모델(실측 성과 아님), DB 미저장 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
        <ConnectionBadge state="demo" hint="추정 모델·미저장" />
        <span>채널 믹스·ROI·KPI는 입력값 기반 <b>추정 모델</b>입니다(실측 성과 아님). 계획은 현재 저장되지 않습니다 — 실행 성과는 거래처 <a href="/insights" className="font-semibold underline">인사이트</a>에서 실측으로 추적하세요.</span>
      </div>

      <GeoPlannerForm />
    </section>
  );
}
