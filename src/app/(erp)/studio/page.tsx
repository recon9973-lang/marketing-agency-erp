import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StudioHome } from "@/components/studio/StudioHome";
import { getCurrentUser } from "@/server/session";
import { getDefaultOrgId } from "@/server/org";
import { listStudioProjects } from "@/server/repositories/studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "디자인 스튜디오" };

export default async function StudioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const orgId = await getDefaultOrgId();
  const projects = await listStudioProjects(orgId);

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="디자인"
        title="디자인 스튜디오"
        description="템플릿 크기를 고르면 바로 편집을 시작합니다. 카드뉴스·SNS·썸네일·배너를 드래그로 만들고 PNG·JPG·WEBP로 내보내세요."
      />
      <StudioHome
        projects={projects.map((p) => ({
          id: p.id,
          title: p.title,
          kind: p.kind,
          canvasW: p.canvasW,
          canvasH: p.canvasH,
          thumbnail: p.thumbnail,
          updatedAt: p.updatedAt.toISOString()
        }))}
      />
    </div>
  );
}
