import { redirect } from "next/navigation";
import { InsightsView } from "@/components/insights/InsightsView";
import { PageHeader } from "@/components/ui/PageHeader";
import { getClientInsight, listInsightClients } from "@/server/repositories/insights";
import { naverDatalabConfigured } from "@/server/integrations/naver-datalab";
import { isIntegrationConfigured } from "@/server/integrations/status";
import { getCurrentUser } from "@/server/session";

export default async function InsightsPage({
  searchParams
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { client: clientParam } = await searchParams;
  const clients = await listInsightClients(user);
  const selectedId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id ?? null;
  const insight = selectedId ? await getClientInsight(user, selectedId) : null;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="마케팅"
        title="거래처 인사이트"
        description="담당 병원의 채널별 방문자·노출, 검색 순위, 핵심·연관 키워드를 한 화면에서 봅니다."
      />
      <InsightsView
        clients={clients}
        selectedId={selectedId}
        insight={insight}
        searchData={{ datalab: naverDatalabConfigured(), searchAd: isIntegrationConfigured("naverSearchAd") }}
      />
    </section>
  );
}
