import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { IdeaBoard } from "@/components/idea/IdeaBoard";
import { listIdeas } from "@/server/repositories/idea";
import { isAiConfigured } from "@/server/ai/claude";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // AI 생성이 길어질 수 있어 넉넉히.
export const metadata = { title: "아이디어" };

export default async function IdeasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { ideas, clients } = await listIdeas(user);

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="기획 · 아이디어"
        title="아이디어"
        description="러프한 아이디어를 실행 가능한 계획서로 바꿉니다. 정보가 부족해도 합리적 가정을 명시해 요약·로드맵·예산·리스크·KPI가 담긴 표준 실행계획서를 자동 생성하고, 편집·복사·다운로드할 수 있습니다."
      />
      <IdeaBoard ideas={ideas} clients={clients} aiConfigured={isAiConfigured()} />
    </section>
  );
}
