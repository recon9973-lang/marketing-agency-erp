// 목표 경로: src/app/(erp)/geo/page.tsx
//
// GEO 모니터링 — 거래처 선택 → 워크플로우 스테퍼 + KPI 타일 + 업무 탭(현황/설계/기록/가이드).
// UI/UX 리디자인: 세로 스택 6패널 → 탭 정보구조, emerald 모듈 액센트(레퍼런스 샘플 #2 스타일).
// "AI 답변 출현은 보장이 아닌 모니터링 지표" 고지를 상시 표기(기획서 §7).
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { GeoMatrix } from "@/components/geo/GeoMatrix";
import { GeoCandidateGenerator, GeoAnswerRecorder, GeoQuestionAdder } from "@/components/geo/GeoTools";
import { GeoAutoWatch } from "@/components/geo/GeoAutoWatch";
import { GeoChannelGuide } from "@/components/geo/GeoChannelGuide";
import { GeoTabs } from "@/components/geo/GeoTabs";
import { GeoTrendBars } from "@/components/geo/GeoTrendBars";
import { GeoWorkflowSteps } from "@/components/geo/GeoWorkflowSteps";
import { GeoLlmsTxt } from "@/components/geo/GeoLlmsTxt";
import { configuredEngines } from "@/server/geo-engine/engines";
import { buildLlmsTxt, llmsInputFromClient } from "@/server/geo-engine/llms-txt";
import { GEO_DISCLAIMER } from "@/domain/sales/geo";
import { db } from "@/server/db";
import { geoMonthlyTrend, listGeoMatrix, listPublishedPages, summarizeGeoMatrix } from "@/server/repositories/geo";
import { listInsightClients } from "@/server/repositories/insights";
import { getCurrentUser } from "@/server/session";

const KPI_ICONS = {
  question: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 17c4 0 7-2.9 7-6.5S14 4 10 4 3 6.9 3 10.5c0 1.6.6 3 1.6 4.1L4 17l3-.9c.9.6 2 .9 3 .9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.4 8.7c.2-.9 1-1.4 1.9-1.3.9 0 1.6.7 1.6 1.5 0 1.1-1.5 1.3-1.8 2.2M10 13.4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.5V10l2.4 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 10S5.3 5 10 5s7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  link: (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8.5 11.5 11.5 8.5M7 13l-1.2 1.2a2.5 2.5 0 0 1-3.5-3.5L5.5 7.5A2.5 2.5 0 0 1 9 7.5M13 7l1.2-1.2a2.5 2.5 0 0 1 3.5 3.5l-3.2 3.2a2.5 2.5 0 0 1-3.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
} as const;

export default async function GeoPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { client: clientParam } = await searchParams;
  const clients = await listInsightClients(user);
  const selectedId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id ?? null;
  const selectedName = clients.find((c) => c.id === selectedId)?.name ?? "";
  const [rows, trend, selectedClient, publishedPages] = selectedId
    ? await Promise.all([
        listGeoMatrix(selectedId),
        geoMonthlyTrend(selectedId),
        // 거래처의 진료과·지역을 질문 생성 기본값으로 자동 사용(이중 입력 제거)
        db.client
          .findUnique({
            where: { id: selectedId },
            select: {
              region: true,
              industryCategory: { select: { name: true } },
              hospitalProfile: { select: { departments: true } }
            }
          })
          .catch(() => null),
        listPublishedPages(selectedId).catch(() => [])
      ])
    : [[], [], null, []];
  const summary = summarizeGeoMatrix(rows);

  // 진료과 기본값: 업종(진료과목) 마스터 → 병원프로필 진료과 첫 항목 순으로 채움
  const defaultDepartment =
    selectedClient?.industryCategory?.name ??
    selectedClient?.hospitalProfile?.departments?.split(/[,\n]/)[0]?.trim() ??
    "";
  const defaultRegion = selectedClient?.region ?? "";

  // llms.txt 본문(순수 생성) — 게시된 답변 페이지 기반
  const llmsText = buildLlmsTxt(
    llmsInputFromClient({
      hospitalName: selectedName || "병원",
      department: defaultDepartment || null,
      region: defaultRegion || null,
      publishedPages
    })
  );
  const publishedUrls = publishedPages.map((p) => p.publishedUrl);

  const kpis = [
    { label: "전체 질문", value: summary.totalQuestions, icon: KPI_ICONS.question, tone: "emerald" },
    { label: "승인 대기", value: summary.candidateCount, icon: KPI_ICONS.clock, tone: summary.candidateCount > 0 ? "amber" : "emerald" },
    { label: "출현 질문", value: summary.appearedCount, icon: KPI_ICONS.eye, tone: "emerald" },
    { label: "인용 질문", value: summary.citedCount, icon: KPI_ICONS.link, tone: "emerald" }
  ] as const;

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="SEO·GEO 실행 프로그램"
        title="GEO 모니터링"
        description="생성형 AI(ChatGPT·Perplexity·Gemini 등) 답변에서 병원 언급·인용을 질문 단위로 관측합니다."
      />

      {/* 미보장 고지 — 상시 표기 */}
      <p className="rounded-xl border border-line bg-surface/60 px-3 py-2 text-[11px] text-slate-500">{GEO_DISCLAIMER}</p>

      {clients.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
          거래처가 없습니다. 먼저 영업 리드를 거래처로 전환해주세요.
        </p>
      ) : (
        <>
          {/* 거래처 선택 탭 */}
          <div className="flex flex-wrap gap-1.5">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/geo?client=${c.id}`}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  c.id === selectedId
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-line bg-card text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          <GeoWorkflowSteps />

          {/* KPI 타일 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((s) => (
              <div key={s.label} className="rounded-2xl border border-line bg-card p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      s.tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {s.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xl font-bold leading-tight text-ink">{s.value}</span>
                    <span className="block truncate text-[11px] text-slate-500">{s.label}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {selectedId && (
            <GeoTabs
              defaultIndex={rows.length === 0 ? 1 : 0}
              tabs={[
                { key: "status", label: "관측 현황", badge: summary.totalQuestions },
                { key: "design", label: "질문 설계", badge: summary.candidateCount },
                { key: "record", label: "수동 기록" },
                { key: "index", label: "색인·llms.txt", badge: publishedUrls.length },
                { key: "guide", label: "채널 가이드" }
              ]}
            >
              <>
                <GeoAutoWatch
                  clientId={selectedId}
                  configuredEngines={configuredEngines().map((e) => e.engine)}
                  monitorableCount={rows.filter((r) => r.status === "APPROVED" || r.status === "MONITORING").length}
                />
                <GeoMatrix clientId={selectedId} rows={rows} />
                <GeoTrendBars trend={trend} />
              </>
              <>
                <GeoCandidateGenerator clientId={selectedId} defaultDepartment={defaultDepartment} defaultRegion={defaultRegion} />
                <GeoQuestionAdder clientId={selectedId} />
              </>
              <GeoAnswerRecorder questions={rows} />
              <GeoLlmsTxt clientName={selectedName} llmsText={llmsText} urls={publishedUrls} />
              <GeoChannelGuide defaultOpen />
            </GeoTabs>
          )}
        </>
      )}
    </section>
  );
}
