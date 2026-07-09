import { redirect } from "next/navigation";
import { KeywordLookup } from "@/components/keywords/KeywordLookup";
import { PageHeader } from "@/components/ui/PageHeader";
import { naverDatalabConfigured } from "@/server/integrations/naver-datalab";
import { isIntegrationConfigured } from "@/server/integrations/status";
import { getCurrentUser } from "@/server/session";

export default async function KeywordsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const searchAd = isIntegrationConfigured("naverSearchAd");
  const datalab = naverDatalabConfigured();
  const configured = searchAd || datalab;

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="마케팅"
        title="검색량 조회"
        description="거래처 키워드의 월간 검색수를 확인합니다."
      />

      <div
        className={`rounded-md border px-4 py-3 text-sm ${
          configured
            ? "border-brand/30 bg-brand/10 text-brand"
            : "border-line bg-surface/60 text-slate-600"
        }`}
      >
        {searchAd ? (
          <p>
            <b>네이버 검색광고 연동됨</b> — 실제 월간 검색수가 표시됩니다.
          </p>
        ) : datalab ? (
          <p>
            <b>네이버 데이터랩 연동됨</b> — 실제 검색어 트렌드(최근 6개월, 상대 지표 0~100)가 표시됩니다. 절대 월간
            검색수가 필요하면 검색광고 API 키를 추가하세요.
          </p>
        ) : (
          <p>
            <b>미연동(데모 모드)</b> — 지금은 추정치가 표시됩니다. <code>NAVER_AD_API_KEY</code>,{" "}
            <code>NAVER_AD_SECRET</code>, <code>NAVER_AD_CUSTOMER_ID</code>를 환경 변수에 넣으면 실제
            검색량으로 바뀝니다. (코드 변경 없음 · 서버 이관 시에도 env만 옮기면 됩니다.)
          </p>
        )}
      </div>

      <KeywordLookup />
    </section>
  );
}
