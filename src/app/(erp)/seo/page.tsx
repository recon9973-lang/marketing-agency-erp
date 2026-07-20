// SEO 진단 — 홈페이지 실측 진단 + 부족항목(수정할 내용) 정리.
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { SeoDiagnose } from "@/components/seo/SeoDiagnose";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";
// 외부 페이지 fetch가 있어 넉넉히.
export const maxDuration = 30;
export const metadata = { title: "SEO 진단" };

export default async function SeoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="분석 · SEO"
        title="SEO 진단"
        description="홈페이지를 실측 진단하고 부족한 부분(수정할 내용)을 정리합니다. 검색·AI 노출(GEO)의 토대가 됩니다."
      />
      <SeoDiagnose />
    </section>
  );
}
