// GEO 콘텐츠 빌더 — GEO Studio M3(geo_content_builder) 화면.
// SEO 콘텐츠 → AI 인용 최적(GEO) 점수·E-E-A-T·FAQ(JSON-LD)·BLUF 재작성(현재 규칙 기반).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeoContentForm } from "@/components/geo-content/GeoContentForm";
import { getCurrentUser } from "@/server/session";

export default async function GeoContentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="GEO Studio · M3"
        title="GEO 콘텐츠 빌더"
        description="한 번 쓴 콘텐츠가 ChatGPT·Gemini·Claude·Perplexity 답변에 인용되도록 진단·재작성합니다. GEO 점수(BLUF·FAQ·인용가능성·E-E-A-T·구조화) + FAQPage JSON-LD + BLUF 재작성을 산출합니다."
      />
      <GeoContentForm />
    </section>
  );
}
