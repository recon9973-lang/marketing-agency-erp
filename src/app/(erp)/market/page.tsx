// 상권분석 — 지역(주소/구)+진료과 입력 → 인구·성별·병원 밀집도·진료과 수요 실측.
// 데이터: 행안부 주민등록 + 심평원 병원정보·상병통계 (location-auto 스킬 ①②③축 ERP 상시 소스).
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { MarketAnalysis } from "@/components/market/MarketAnalysis";

export default async function MarketPage({
  searchParams
}: {
  searchParams: Promise<{ region?: string; specialty?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { region, specialty } = await searchParams;
  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="상권분석 · 실측"
        title="상권분석"
        description="지역(주소 또는 구)과 진료과를 입력하면 인구·성별, 병원 밀집도·종별, 진료과 수요를 행안부·심평원 실측 데이터로 즉시 분석합니다."
      />
      <MarketAnalysis presetRegion={region ?? ""} presetSpecialty={specialty ?? ""} />
    </section>
  );
}
