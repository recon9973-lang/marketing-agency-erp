// GEO 콘텐츠 빌더 — GEO Studio M3(geo_content_builder) 화면.
// SEO 콘텐츠 → AI 인용 최적(GEO) 점수·E-E-A-T·FAQ(JSON-LD)·BLUF 재작성(현재 규칙 기반).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
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

      {/* 데이터 연결 상태 — 점수는 붙여넣은 콘텐츠의 규칙 기반 진단(실제 AI 인용 측정 아님) */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
        <ConnectionBadge state="demo" hint="규칙 기반 진단" />
        <span>GEO 점수는 입력한 콘텐츠를 <b>규칙 기반</b>으로 진단한 값입니다(실제 AI 인용 측정 아님). 실측 인용 모니터링은 <a href="/geo" className="font-semibold underline">GEO 모니터링</a>에서 확인하세요.</span>
      </div>

      <GeoContentForm />
    </section>
  );
}
