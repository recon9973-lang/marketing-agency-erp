// 마케팅 전략 — 병원_검색여정·퍼널 트랙. 상권분석(트랙1)을 근거로 소비해
// 수주 진단(대응 방향) + 키워드 실측을 낸다. 상권분석(/market)과 별개 트랙.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { StrategyAnalysis } from "@/components/strategy/StrategyAnalysis";
import { SavedStrategyReports } from "@/components/strategy/SavedStrategyReports";
import { listStrategyReports } from "@/server/actions/strategy";

export default async function StrategyPage({
  searchParams
}: {
  searchParams: Promise<{ region?: string; specialty?: string; brand?: string; url?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { region, specialty, brand, url } = await searchParams;
  const listed = await listStrategyReports().catch(() => null);
  const reports = listed && listed.ok ? listed.data : [];
  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="마케팅 전략 · 검색여정·퍼널"
        title="마케팅 전략"
        description="병원·지역·진료과를 입력하면 상권 실측을 근거로 수주 매력도·진입 대응 방향과 키워드 실측(검색량·경쟁·포화도)을 생성합니다. 상권 데이터 자체는 상권분석 화면에서 봅니다."
      />
      <StrategyAnalysis presetRegion={region ?? ""} presetSpecialty={specialty ?? ""} presetBrand={brand ?? ""} presetUrl={url ?? ""} />
      <SavedStrategyReports reports={reports} />
    </section>
  );
}
