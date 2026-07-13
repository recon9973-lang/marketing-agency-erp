import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ImageDown } from "lucide-react";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <DashboardHeader
          eyebrow="디자인"
          title="디자인 스튜디오"
          description="템플릿 크기를 고르면 바로 편집을 시작합니다. 카드뉴스·SNS·썸네일·배너를 드래그로 만들고 PNG·JPG·WEBP로 내보내세요."
        />
        <Link
          href={"/studio/convert" as Route}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
        >
          <ImageDown className="h-4 w-4" /> 이미지 변환 도구
        </Link>
      </div>
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
