import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AiStudio } from "@/components/ai/AiStudio";
import { isAiConfigured } from "@/server/ai/claude";
import { listAiContentForUser } from "@/server/repositories/ai-content";
import { listClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

// ANTHROPIC_API_KEY를 요청 시점에 읽어 활성 여부를 정확히 반영.
export const dynamic = "force-dynamic";
// AI 생성은 수십 초 걸릴 수 있어 서버리스 타임아웃을 넉넉히.
export const maxDuration = 60;

export const metadata = { title: "AI 마케팅 엔진" };

export default async function AiStudioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [clients, history] = await Promise.all([
    listClientsForUser(user),
    listAiContentForUser(user)
  ]);
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="AI 마케팅 엔진"
        title="AI 콘텐츠 생성"
        description="거래처·주제·키워드를 넣으면 Claude가 블로그·카드뉴스·SNS·광고 문구를 바로 만들어 줍니다. 생성 결과는 복사해 원고 스튜디오나 발행에 활용하세요."
      />
      <AiStudio clients={clientOptions} history={history} aiConfigured={isAiConfigured()} />
    </div>
  );
}
