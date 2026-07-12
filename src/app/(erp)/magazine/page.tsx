// 목표 경로: src/app/(erp)/magazine/page.tsx
//
// GROUND 매거진 콘텐츠 큐 — 용어·주제 대량 등록 → 큐 관리(초안·검토·발행은 후속).
// 병원 콘텐츠와 분리된 자사 미디어 트랙(의료법·거래처 승인 게이트 없음).
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { MagazineImport } from "@/components/magazine/MagazineImport";
import { MagazineQueue } from "@/components/magazine/MagazineQueue";
import { MAGAZINE_CATEGORIES } from "@/domain/content/magazine";
import { listMagazineQueue, magazineSummary } from "@/server/repositories/magazine";
import { getCurrentUser } from "@/server/session";

export default async function MagazinePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { category } = await searchParams;
  const activeCategory = category && (MAGAZINE_CATEGORIES as readonly string[]).includes(category) ? category : undefined;

  const [rows, summary] = await Promise.all([
    listMagazineQueue({ category: activeCategory }).catch(() => []),
    magazineSummary().catch(() => ({ total: 0, queued: 0, drafted: 0, reviewed: 0, published: 0 }))
  ]);

  const kpis = [
    { label: "전체", value: summary.total },
    { label: "큐 대기", value: summary.queued },
    { label: "초안", value: summary.drafted },
    { label: "발행", value: summary.published }
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="GROUND · 자사 미디어"
        title="매거진 콘텐츠"
        description="GROUND(seokorea.org) 매거진용 용어·주제를 대량 등록하고 발행 큐로 관리합니다. 병원 콘텐츠와 분리된 트랙입니다."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-2xl border border-line bg-card p-4">
            <p className="text-[11px] text-slate-500">{s.label}</p>
            <p className="text-xl font-bold text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-1.5">
        <a
          href="/magazine"
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            !activeCategory ? "border-emerald-600 bg-emerald-600 text-white" : "border-line bg-card text-slate-600 hover:text-emerald-700"
          }`}
        >
          전체
        </a>
        {MAGAZINE_CATEGORIES.map((c) => (
          <a
            key={c}
            href={`/magazine?category=${encodeURIComponent(c)}`}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              activeCategory === c ? "border-emerald-600 bg-emerald-600 text-white" : "border-line bg-card text-slate-600 hover:text-emerald-700"
            }`}
          >
            {c}
          </a>
        ))}
      </div>

      <MagazineImport />
      <MagazineQueue rows={rows} />

      <p className="rounded-xl border border-line bg-surface/60 px-3 py-2 text-[11px] text-slate-500">
        다음 단계: 큐 항목 → AI 초안 자동 생성(하루 N개) → 검토 → 워드프레스 예약 발행 + 커버 자동 생성. (후속 PR)
      </p>
    </section>
  );
}
