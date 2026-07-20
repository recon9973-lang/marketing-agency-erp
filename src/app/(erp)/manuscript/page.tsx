// 원고 스튜디오 — 거래처별 집필 프로젝트(프롬프트) 관리. 실제 콘텐츠 생성은 GEO(콘텐츠 생성)에서 진행/연결.
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ManuscriptProjects } from "@/components/manuscript/ManuscriptProjects";
import { listInsightClients } from "@/server/repositories/insights";
import { listManuscriptDrafts, listManuscriptProjects } from "@/server/repositories/manuscript";
import { isAiConfigured } from "@/server/ai/claude";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "원고 스튜디오" };

export default async function ManuscriptStudioPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { client: clientParam } = await searchParams;
  const clients = await listInsightClients(user);
  const selectedId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id ?? null;
  const selectedName = clients.find((c) => c.id === selectedId)?.name ?? "";
  const projects = selectedId ? await listManuscriptProjects(selectedId) : [];
  const drafts = await listManuscriptDrafts(projects.map((p) => p.id));
  const aiConfigured = isAiConfigured();

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="제작 · 원고"
        title="원고 스튜디오"
        description="거래처별 집필 프로젝트(프롬프트·브리프)를 설정하고, 프로젝트 안에서 원고를 자체 제작합니다. 직접 작성하거나 AI 초안 생성(연동 시)을 활용할 수 있습니다."
      />

      {clients.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
          거래처가 없습니다. 먼저 영업 리드를 거래처로 전환해 주세요.
        </p>
      ) : (
        <>
          {/* 거래처 선택 */}
          <div className="flex flex-wrap gap-1.5">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/manuscript?client=${c.id}` as Route}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  c.id === selectedId
                    ? "border-brand bg-brand text-white shadow-sm"
                    : "border-line bg-card text-slate-600 hover:border-brand/40 hover:text-brand"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {selectedId && <ManuscriptProjects clientId={selectedId} clientName={selectedName} rows={projects} drafts={drafts} aiConfigured={aiConfigured} />}
        </>
      )}
    </section>
  );
}
