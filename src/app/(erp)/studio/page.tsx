import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ImageDown, Palette, LayoutTemplate, Sparkles } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StudioHome } from "@/components/studio/StudioHome";
import { ImageStudio } from "@/components/ai/ImageStudio";
import { isImageConfigured } from "@/server/ai/image";
import { listVaultFolders } from "@/server/repositories/vault";
import { Role } from "@/domain/types";
import { getCurrentUser } from "@/server/session";
import { getDefaultOrgId } from "@/server/org";
import { listStudioProjects } from "@/server/repositories/studio";

export const dynamic = "force-dynamic";
// AI 이미지 생성은 수십 초 걸릴 수 있어 넉넉히.
export const maxDuration = 60;
export const metadata = { title: "스튜디오" };

const TABS = [
  { key: "design", label: "디자인 편집", icon: LayoutTemplate },
  { key: "image", label: "AI 이미지 생성", icon: Sparkles }
] as const;

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tab } = await searchParams;
  const active: "design" | "image" = tab === "image" ? "image" : "design";
  const isAdmin = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;

  const orgId = await getDefaultOrgId();
  const [projects, folders] = await Promise.all([
    listStudioProjects(orgId),
    active === "image" ? listVaultFolders().catch(() => []) : Promise.resolve([])
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <DashboardHeader
          eyebrow="제작"
          title="스튜디오"
          description="디자인 편집과 AI 이미지 생성을 한 곳에서. 카드뉴스·SNS·썸네일·배너를 드래그로 만들고 PNG·JPG·WEBP로 내보내세요."
        />
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && (
            <Link
              href={"/studio/brand" as Route}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
            >
              <Palette className="h-4 w-4" /> 브랜드킷
            </Link>
          )}
          <Link
            href={"/studio/convert" as Route}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
          >
            <ImageDown className="h-4 w-4" /> 이미지 변환 도구
          </Link>
        </div>
      </div>

      {/* 디자인 편집 · AI 이미지 생성 탭 (이미지·디자인 스튜디오 병합) */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const on = active === t.key;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={`/studio?tab=${t.key}` as Route}
              aria-current={on ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                on ? "border-brand bg-brand text-white shadow-sm" : "border-line bg-card text-slate-600 hover:border-brand/40 hover:text-brand"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
      </div>

      {active === "design" ? (
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
      ) : (
        <ImageStudio imageConfigured={isImageConfigured()} folders={folders.map((f) => ({ id: f.id, name: f.name }))} />
      )}
    </div>
  );
}
