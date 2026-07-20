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
import { SovChart } from "@/components/geo/SovChart";
import { MentionRateTrend } from "@/components/geo/MentionRateTrend";
import { GuardedRankTrend } from "@/components/geo/GuardedRankTrend";
import { ScorePair } from "@/components/geo/ScorePair";
import { EngineRadar } from "@/components/geo/EngineRadar";
import { MentionStanding } from "@/components/geo/MentionStanding";
import { QuestionMentionTrend } from "@/components/geo/QuestionMentionTrend";
import { GeoPhaseProgress } from "@/components/geo/GeoPhaseProgress";
import { GeoToolLinks } from "@/components/geo/GeoToolLinks";
import { GeoOpportunity } from "@/components/geo/GeoOpportunity";
import { GeoMonthlyReport } from "@/components/geo/GeoMonthlyReport";
import { opportunityScore, strategyDirections } from "@/server/geo-studio/opportunity";
import { GeoLlmsTxt } from "@/components/geo/GeoLlmsTxt";
import { configuredEngines } from "@/server/geo-engine/engines";
import { buildLlmsTxt, llmsInputFromClient } from "@/server/geo-engine/llms-txt";
import { GEO_DISCLAIMER } from "@/domain/sales/geo";
import { db } from "@/server/db";
import { computeGeoSov, geoMonthlyTrend, listGeoMatrix, listPublishedPages, summarizeGeoMatrix } from "@/server/repositories/geo";
import {
  getMentionRateSeries,
  getGuardedRankSeries,
  getEngineRadar,
  getMentionStanding,
  getQuestionMentionSeries
} from "@/server/repositories/citation-score";
import { listInsightClients } from "@/server/repositories/insights";
import { getCurrentUser } from "@/server/session";
import { GeoStageNav } from "@/components/geo/GeoStageNav";
import { GeoSelfQuery } from "@/components/geo/GeoSelfQuery";
import { GeoStagePanel } from "@/components/geo/GeoStagePanel";
import { GeoKeywordPanel } from "@/components/geo/GeoKeywordPanel";
import { CdjFunnelMap } from "@/components/geo/CdjFunnelMap";
import { listGeoKeywords, listSelectedGeoKeywords } from "@/server/repositories/geo-keyword";
import { naverSearchConfigured } from "@/server/integrations/naver-search";
import { discoverCepsLive, cepRealConfigured } from "@/server/geo-studio/cep/live-finder";
import { discoverCeps } from "@/server/geo-studio/cep/finder";
import { ClusterBubbleMap, type BubbleCep } from "@/components/geo-cep/ClusterBubbleMap";
import { analyzeJourney, analyzeJourneyLive, type JourneyReport } from "@/server/geo-studio/path/analyzer";
import { JourneyGraph, type RawNode } from "@/components/geo-path/JourneyGraph";
import { GeoContentForm } from "@/components/geo-content/GeoContentForm";
import { SavedContentDiagnoses } from "@/components/geo-content/SavedContentDiagnoses";
import { listContentDiagnoses } from "@/server/repositories/geo-content-diagnosis";
import { AiStudio } from "@/components/ai/AiStudio";
import { listAiContentForUser } from "@/server/repositories/ai-content";
import { isAiConfigured } from "@/server/ai/claude";
import { GeoPlannerForm } from "@/components/geo-planner/GeoPlannerForm";
import { SavedGeoPlans } from "@/components/geo-planner/SavedGeoPlans";
import { listGeoCampaignPlans } from "@/server/repositories/geo-campaign-plan";
import { GeoLearningPanel, type VersionRow } from "@/components/geo/GeoLearningPanel";
import { listModelVersions } from "@/server/repositories/geo-model";
import { getDefaultOrgId } from "@/server/org";
import { Role } from "@/domain/types";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { GEO_STAGES, geoStageOf, type GeoStageKey } from "@/domain/geo/stages";

// P2.1: 각 단계의 CTA(현재는 전용 도구로 이어짐 — P2.2~에서 인라인 통합).
const STAGE_CTA: Record<GeoStageKey, string> = {
  keyword: "검색량 조회 열기",
  questions: "질문 설계 열기",
  citation: "AI 스캐너 열기",
  cep: "CEP 파인더 열기",
  journey: "여정 분석 열기",
  dashboard: "대시보드",
  "content-diagnosis": "콘텐츠 진단 열기",
  plan: "GEO 주간 리포트 열기",
  content: "콘텐츠 생성 열기",
  campaign: "캠페인 플래너 열기",
  learning: "학습 패널 열기"
};
const STAGE_TIER: Partial<Record<GeoStageKey, "measured" | "approx" | "demo">> = {
  keyword: "measured",
  questions: "measured",
  citation: "measured",
  cep: "approx",
  journey: "approx",
  "content-diagnosis": "demo",
  plan: "measured",
  content: "measured",
  campaign: "demo"
};
function stageHref(tab: GeoStageKey, clientId: string | null, brand: string, category: string): string {
  const b = encodeURIComponent(brand || "");
  const c = encodeURIComponent(category || "");
  switch (tab) {
    case "keyword":
      return "/keywords";
    case "questions":
      return `/geo?client=${clientId ?? ""}&tab=dashboard`;
    case "citation":
      return `/geo-scan?brand=${b}`;
    case "cep":
      return `/geo-cep?brand=${b}&category=${c}`;
    case "journey":
      return "/geo-path";
    case "content-diagnosis":
      return "/geo-content";
    case "plan":
      return "/reports/geo-weekly";
    case "content":
      return "/ai-studio";
    case "campaign":
      return "/geo-planner";
    case "learning":
      return "/geo-learning";
    default:
      return "/geo";
  }
}

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

export default async function GeoPage({ searchParams }: { searchParams: Promise<{ client?: string; tab?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { client: clientParam, tab: tabParam } = await searchParams;
  const activeTab = geoStageOf(tabParam);
  const clients = await listInsightClients(user);
  const selectedId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id ?? null;
  const selectedName = clients.find((c) => c.id === selectedId)?.name ?? "";
  const [rows, trend, selectedClient, publishedPages, mentionSeries, guardedSeries, engineRadar, standing, questionSeries] = selectedId
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
        listPublishedPages(selectedId).catch(() => []),
        getMentionRateSeries(selectedId).catch(() => []), // B1 전체 언급률 일별
        getGuardedRankSeries(selectedId).catch(() => []), // C1 월보장 순위 일별
        getEngineRadar(selectedId).catch(() => ({ engines: [], beforeDate: null, nowDate: null })), // B2
        getMentionStanding(selectedId, selectedName).catch(() => []), // B4
        getQuestionMentionSeries(selectedId).catch(() => ({ dates: [], questions: [] })) // B3
      ])
    : [[], [], null, [], [], [], { engines: [], beforeDate: null, nowDate: null }, [], { dates: [], questions: [] }];
  const summary = summarizeGeoMatrix(rows);
  const sov = computeGeoSov(rows); // 경쟁사 대비 SOV(파생·저장 없음)

  // A1 점수 — GEO=최신 언급률(성과), SEO=월보장 유지율(토대, 보장 키워드 없으면 null)
  const geoScore = mentionSeries.length ? mentionSeries[mentionSeries.length - 1].rate : 0;
  const guardHeld = guardedSeries.filter((s) => {
    const last = [...s.points].reverse().find((p) => p.rank != null);
    return last && s.targetRank != null && (last.rank as number) <= s.targetRank;
  }).length;
  const seoScore = guardedSeries.length ? Math.round((guardHeld / guardedSeries.length) * 100) : null;

  // G4 — GEO 6단계(P0~P5) 완료 신호를 실제 데이터로 판정.
  const hasBaseline = rows.some((r) => Object.keys(r.cells).length > 0);
  const hasTechnical = publishedPages.length > 0 || rows.some((r) => Boolean(r.targetPageUrl));
  const hasContent = rows.some((r) => Boolean(r.answerPlanId));
  const hasAuthority = summary.citedCount > 0;
  const isMonitoring = mentionSeries.length >= 2;
  const geoPhases = [
    { code: "P0", label: "온보딩", sub: "자산·질문 수집", done: Boolean(selectedId) },
    { code: "P1", label: "진단·기준선", sub: "AI 노출 0 박제", done: hasBaseline },
    { code: "P2", label: "테크니컬", sub: "구조화·저자·색인", done: hasTechnical },
    { code: "P3", label: "콘텐츠 엔진", sub: "답변 페이지 생성", done: hasContent },
    { code: "P4", label: "인용·권위", sub: "공식 URL 인용", done: hasAuthority },
    { code: "P5", label: "모니터링", sub: "추이·월간 리포트", done: isMonitoring }
  ];

  // G5 — 기회점수·전략(규칙 기반)·월간 리포트 데이터
  const citationRate = summary.monitoredCount > 0 ? Math.round((summary.citedCount / summary.monitoredCount) * 100) : 0;
  const oppScore = opportunityScore({ mentionRate: geoScore, citationRate, publishedPages: publishedPages.length, hasContent });
  const weakEngines = engineRadar.engines.filter((e) => e.now < 20).map((e) => e.engine);
  const usRow = standing.find((r) => r.isUs);
  const competitorAhead = standing.find((r) => !r.isUs && usRow && r.rate >= usRow.rate)?.name ?? null;
  const strategies = strategyDirections({
    mentionRate: geoScore,
    citationRate,
    monitoredCount: summary.monitoredCount,
    hasContent,
    publishedPages: publishedPages.length,
    weakEngines,
    competitorAhead
  });
  const reportData = {
    mentionStart: mentionSeries[0]?.rate ?? null,
    mentionNow: mentionSeries.length ? mentionSeries[mentionSeries.length - 1].rate : null,
    citedCount: summary.citedCount,
    monitoredCount: summary.monitoredCount,
    guardHeld,
    guardTotal: guardedSeries.length,
    publishedCount: publishedPages.length
  };

  // 진료과 기본값: 업종(진료과목) 마스터 → 병원프로필 진료과 첫 항목 순으로 채움
  const defaultDepartment =
    selectedClient?.industryCategory?.name ??
    selectedClient?.hospitalProfile?.departments?.split(/[,\n]/)[0]?.trim() ??
    "";
  const defaultRegion = selectedClient?.region ?? "";

  // 단계1(키워드) 인라인 데이터 — 해당 탭에서만 조회.
  const geoKeywordRows = activeTab === "keyword" && selectedId ? await listGeoKeywords(selectedId) : [];
  const naverConfigured = naverSearchConfigured();
  // 단계2·4·5·대시보드에서 참고할 채택 키워드.
  const needsKw = ["dashboard", "questions", "cep", "journey"].includes(activeTab);
  const selectedKw = needsKw && selectedId ? await listSelectedGeoKeywords(selectedId) : [];

  // 단계4(CEP) — 브랜드=거래처명, 카테고리=진료과. 채택 키워드를 시드로.
  const cepBrand = selectedName || "브랜드";
  const cepCategory = defaultDepartment || selectedName || "";
  let cepCeps: BubbleCep[] = [];
  let cepTier: "measured" | "demo" = "demo";
  let cepNote: string | null = null;
  if (activeTab === "cep" && selectedId && cepCategory) {
    const live = cepRealConfigured()
      ? await discoverCepsLive(cepBrand, cepCategory, { seedKeyword: selectedKw[0] ?? cepCategory }).catch(() => null)
      : null;
    if (live && Array.isArray(live.ceps) && live.ceps.length > 0) {
      cepCeps = live.ceps as unknown as BubbleCep[];
      cepTier = live.data_tier === "measured" ? "measured" : "demo";
      cepNote = live.note ?? null;
    } else {
      const mock = discoverCeps(cepBrand, cepCategory, { extraKeywords: selectedKw.slice(0, 10) }) as { ceps?: unknown[] };
      cepCeps = ((mock?.ceps ?? []) as unknown) as BubbleCep[];
      cepTier = "demo";
      cepNote = "네이버 연관어·임베딩 미연결 — 데모 군집입니다. 연동 시 실측으로 바뀝니다.";
    }
  }

  // 단계5(여정) — 시드 질의=채택 키워드 최상위(없으면 진료과).
  const journeySeed = selectedKw[0] ?? defaultDepartment ?? selectedName;
  let journeyReport: JourneyReport | null = null;
  let journeyTier: "approx" | "demo" = "demo";
  if (activeTab === "journey" && selectedId && journeySeed) {
    const live = await analyzeJourneyLive(selectedName || "브랜드", journeySeed).catch(() => null);
    if (live) {
      journeyReport = live;
      journeyTier = "approx";
    } else {
      journeyReport = analyzeJourney(selectedName || "브랜드", journeySeed);
      journeyTier = "demo";
    }
  }

  // 단계7(콘텐츠 진단)·단계9(콘텐츠 생성) 데이터.
  const contentDiagnoses = activeTab === "content-diagnosis" ? await listContentDiagnoses(user).catch(() => []) : [];
  const aiHistory = activeTab === "content" ? await listAiContentForUser(user).catch(() => []) : [];
  const aiConfigured = isAiConfigured();
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  // 단계10(캠페인)·단계11(학습) 데이터.
  const savedPlans = activeTab === "campaign" ? await listGeoCampaignPlans(user).catch(() => []) : [];
  const canManageLearning = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  let learningVersions: VersionRow[] = [];
  if (activeTab === "learning" && canManageLearning) {
    const orgId = await getDefaultOrgId().catch(() => null);
    const vrows = orgId ? await listModelVersions(orgId).catch(() => []) : [];
    learningVersions = vrows.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      summary: v.summary,
      weights: (v.weights as unknown as VersionRow["weights"]) ?? [],
      diff: (v.diff as unknown as VersionRow["diff"]) ?? [],
      basisCount: v.basisCount,
      appliedAt: v.appliedAt ? v.appliedAt.toISOString() : null,
      createdAt: v.createdAt.toISOString()
    }));
  }

  // 화면 안에 인라인 통합된 탭(그 외는 단계 안내 패널).
  const inlineTabs: GeoStageKey[] = [
    "dashboard",
    "keyword",
    "questions",
    "citation",
    "cep",
    "journey",
    "content-diagnosis",
    "content",
    "plan",
    "campaign",
    "learning"
  ];

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
    { label: "인용 질문", value: summary.citedCount, icon: KPI_ICONS.link, tone: "emerald" },
    {
      label: "경쟁사 SOV",
      value: sov.sovPct === null ? "—" : `${sov.sovPct}%`,
      icon: KPI_ICONS.eye,
      tone: sov.sovPct !== null && sov.sovPct < 50 ? "amber" : "emerald"
    }
  ] as const;

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="SEO·GEO 실행 프로그램"
        title="GEO"
        description="키워드 선별 → 질문 → 4대 AI 인용 → CEP → 여정 → 통합 대시보드 → 콘텐츠 → 계획 → 캠페인 → 학습을 한 화면에서 이어서 진행합니다."
      />

      {/* 미보장 고지 — 상시 표기 */}
      <p className="rounded-xl border border-line bg-surface/60 px-3 py-2 text-[11px] text-slate-500">{GEO_DISCLAIMER}</p>

      {clients.length === 0 ? (
        <div className="space-y-3">
          <p className="rounded-2xl border border-line bg-card p-4 text-center text-sm text-slate-500">
            등록된 거래처가 없습니다. 계약 단계에서 이어받거나, 아래에서 업체명·키워드를 입력해 바로 자체 조회할 수 있습니다.
          </p>
          <GeoSelfQuery />
        </div>
      ) : (
        <>
          {/* 자체 조회 — 거래처가 있어도 언제든 빠르게(접이식). 선택 거래처 정보를 기본값으로 채움. */}
          <details className="group rounded-2xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/30">
            <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 marker:content-none">
              <span className="inline-flex items-center gap-2">
                <span className="transition-transform group-open:rotate-90">▶</span>
                자체 조회 (거래처 없이 업체명·키워드로 빠르게)
              </span>
            </summary>
            <div className="px-2 pb-2">
              <GeoSelfQuery presetBrand={selectedName} presetKeyword={defaultDepartment} />
            </div>
          </details>

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

          {/* GEO 11단계 통합 탭바 */}
          <GeoStageNav clientId={selectedId} active={activeTab} />

          {/* 단계1 — 키워드 */}
          {activeTab === "keyword" && selectedId && (
            <GeoKeywordPanel clientId={selectedId} clientName={selectedName} rows={geoKeywordRows} configured={naverConfigured} />
          )}

          {/* 단계2 — 질문 추출 (채택 키워드 연동) */}
          {activeTab === "questions" && selectedId && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-800">
                  단계1에서 채택한 <b>{selectedKw.length}개</b> 키워드가 질문 생성에 반영됩니다.
                  {selectedKw.length > 0 && <span className="ml-1 text-emerald-600">{selectedKw.slice(0, 8).join(" · ")}</span>}
                  {selectedKw.length === 0 && (
                    <a href={`/geo?client=${selectedId}&tab=keyword`} className="ml-1 font-semibold underline">
                      먼저 키워드를 채택하세요 →
                    </a>
                  )}
                </p>
              </div>
              <GeoCandidateGenerator clientId={selectedId} defaultDepartment={defaultDepartment} defaultRegion={defaultRegion} />
              <GeoQuestionAdder clientId={selectedId} />
              <GeoMatrix clientId={selectedId} rows={rows} />
            </div>
          )}

          {/* 단계3 — 4대 AI 인용 측정 */}
          {activeTab === "citation" && selectedId && (
            <div className="space-y-4">
              <GeoAutoWatch
                clientId={selectedId}
                configuredEngines={configuredEngines().map((e) => e.engine)}
                monitorableCount={rows.filter((r) => r.status === "APPROVED" || r.status === "MONITORING").length}
              />
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-line bg-card p-4">
                  <h3 className="mb-1 text-sm font-bold text-ink">AI 모델별 언급률</h3>
                  <p className="mb-3 text-[11px] text-slate-500">엔진별 분포 · 첫 관측 대비 현재</p>
                  <EngineRadar data={engineRadar} />
                </div>
                <div className="rounded-2xl border border-line bg-card p-4">
                  <h3 className="mb-1 text-sm font-bold text-ink">언급 현황 (우리 vs 경쟁사)</h3>
                  <p className="mb-3 text-[11px] text-slate-500">질문×엔진 최신 관측 기준 랭킹</p>
                  <MentionStanding rows={standing} />
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-card p-4">
                <h3 className="mb-1 text-sm font-bold text-ink">전체 언급률 추이</h3>
                <p className="mb-3 text-[11px] text-slate-500">AI 답변이 우리 병원을 인용하는 비율 · 주 1회 관측</p>
                <MentionRateTrend points={mentionSeries} />
              </div>
              <GeoMatrix clientId={selectedId} rows={rows} />
            </div>
          )}

          {/* 단계4 — CEP (카테고리 진입점 군집) */}
          {activeTab === "cep" && selectedId && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-line bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">4</span>
                  <h3 className="text-base font-bold text-ink">CEP — 카테고리 진입점</h3>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${cepTier === "measured" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                    {cepTier === "measured" ? "실측" : "데모"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  <b className="text-slate-600">{cepBrand}</b> · 카테고리 <b className="text-slate-600">{cepCategory || "미지정"}</b> 기준 소비자 구매 계기(CEP) 군집.
                </p>
                {cepNote && <p className="mt-1 text-[11px] text-amber-600">{cepNote}</p>}
              </div>
              {cepCeps.length > 0 ? (
                <ClusterBubbleMap ceps={cepCeps} seedLabel={cepCategory} />
              ) : (
                <p className="rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-slate-500">
                  진료과(카테고리)가 설정되면 CEP 군집을 표시합니다. 거래처 상세에서 업종/진료과를 지정하세요.
                </p>
              )}
            </div>
          )}

          {/* 단계5 — 여정 (검색 경로 네트워크) */}
          {activeTab === "journey" && selectedId && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-line bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">5</span>
                  <h3 className="text-base font-bold text-ink">여정 — 검색 경로 분석</h3>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${journeyTier === "approx" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                    {journeyTier === "approx" ? "근사(연관어 인접)" : "데모"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  시드 질의 <b className="text-slate-600">{journeySeed}</b> 기준 검색 전·후 경로. {journeyReport ? `노드 ${journeyReport.total_nodes} · 브랜드 언급률 ${journeyReport.brand_mention_rate}%` : ""}
                </p>
              </div>
              {journeyReport && (
                <JourneyGraph tree={journeyReport.tree as unknown as RawNode} primaryPath={journeyReport.top_paths[0] ?? []} brand={selectedName} />
              )}
            </div>
          )}

          {/* 단계7 — 콘텐츠 진단 */}
          {activeTab === "content-diagnosis" && (
            <div className="space-y-4">
              <GeoContentForm />
              {contentDiagnoses.length > 0 && (
                <SavedContentDiagnoses items={contentDiagnoses.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))} />
              )}
            </div>
          )}

          {/* 단계9 — 콘텐츠 생성 (AI마케팅·마케팅스튜디오 통합) */}
          {activeTab === "content" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-800">
                  선택 거래처·키워드·질문을 바탕으로 답변형 콘텐츠(블로그·카드뉴스·SNS·광고카피)를 생성합니다. (기존 AI마케팅·마케팅스튜디오 통합)
                </p>
              </div>
              <AiStudio clients={clientOptions} history={aiHistory} aiConfigured={aiConfigured} />
            </div>
          )}

          {/* 단계8 — 계획서 (일·주·월·연 캐던스) */}
          {activeTab === "plan" && selectedId && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">8</span>
                  <h3 className="text-base font-bold text-ink">GEO 실행 계획서 · 캐던스</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">일·주·월·연 단위 실행 리듬과 각 주기의 산출물.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { k: "일간", d: "질문 관측 기록 · 이슈 대응", src: "관측 현황" },
                    { k: "주간", d: "언급률 추이 · 주간 리포트", src: "주간 리포트" },
                    { k: "월간", d: "월간 성과 요약 · 리포트", src: "월간 요약(아래)" },
                    { k: "연간", d: "분기 전략 · 목표 재설정", src: "전략 방향(대시보드)" }
                  ].map((c) => (
                    <div key={c.k} className="rounded-xl border border-line bg-surface/40 p-3">
                      <p className="text-xs font-bold text-ink">{c.k}</p>
                      <p className="mt-1 text-[11px] leading-snug text-slate-600">{c.d}</p>
                      <p className="mt-1 text-[10px] text-emerald-600">{c.src}</p>
                    </div>
                  ))}
                </div>
                <a href="/reports/geo-weekly" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                  주간 리포트 열기
                </a>
              </div>
              <GeoMonthlyReport data={reportData} clientName={selectedName} />
            </div>
          )}

          {/* 단계10 — 캠페인 플래너 */}
          {activeTab === "campaign" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
                <ConnectionBadge state="demo" hint="추정 모델·미저장" />
                <span>채널 믹스·ROI·KPI는 입력값 기반 <b>추정 모델</b>입니다(실측 성과 아님).</span>
              </div>
              <GeoPlannerForm />
              <section className="rounded-2xl border border-line bg-card p-4">
                <p className="mb-2 text-sm font-bold text-ink">
                  저장된 계획 <span className="text-slate-400">({savedPlans.length})</span>
                </p>
                <SavedGeoPlans plans={savedPlans.map((pl) => ({ ...pl, createdAt: pl.createdAt.toISOString() }))} />
              </section>
            </div>
          )}

          {/* 단계11 — 학습 (관리자+) */}
          {activeTab === "learning" &&
            (canManageLearning ? (
              <GeoLearningPanel versions={learningVersions} canManage={canManageLearning} />
            ) : (
              <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-slate-500">
                학습 모듈은 관리자 이상만 볼 수 있습니다.
              </p>
            ))}

          {!inlineTabs.includes(activeTab) && (
            <GeoStagePanel
              stage={GEO_STAGES.find((s) => s.key === activeTab)!}
              clientName={selectedName}
              ctaHref={stageHref(activeTab, selectedId, selectedName, defaultDepartment)}
              ctaLabel={STAGE_CTA[activeTab]}
              tier={STAGE_TIER[activeTab]}
            />
          )}

          {activeTab === "dashboard" && (
            <>
              <GeoPhaseProgress phases={geoPhases} />
              {selectedId && <GeoToolLinks clientId={selectedId} />}

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
            <CdjFunnelMap
              metrics={{
                keywords: selectedKw.length,
                questions: summary.totalQuestions,
                mentionRate: geoScore,
                citedCount: summary.citedCount,
                publishedPages: publishedPages.length
              }}
              clientName={selectedName}
            />
          )}

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
                {/* A1 — GEO/SEO 듀얼 점수(연결·분리) */}
                <ScorePair
                  geoScore={geoScore}
                  seoScore={seoScore}
                  geoNote={`AI 답변 언급률 ${geoScore}% · ${summary.appearedCount}/${summary.monitoredCount} 질문 출현`}
                  seoNote={seoScore === null ? "월보장 키워드 미등록" : `월보장 ${guardHeld}/${guardedSeries.length}건 순위 유지`}
                />

                {/* 언급률·순위 추이 — GEO(성과) / SEO(토대) 연결·분리 (GEO 모듈 설계 §1·§4 B1·C1) */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-card p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">GEO 트랙</span>
                      <h3 className="text-sm font-bold text-ink">전체 언급률 추이</h3>
                      <span className="text-[10px] font-bold text-brand">★ 북극성</span>
                    </div>
                    <p className="mb-3 text-[11px] text-slate-500">AI 답변이 우리 병원을 인용하는 비율 · 주 1회 관측 · 목표 25%</p>
                    <MentionRateTrend points={mentionSeries} />
                  </div>
                  <div className="rounded-2xl border border-line bg-card p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">SEO 트랙</span>
                      <h3 className="text-sm font-bold text-ink">월보장 순위 추이</h3>
                    </div>
                    <p className="mb-3 text-[11px] text-slate-500">네이버 검색 순위(계약 약속) · 매일 자동 축적 · GEO의 토대</p>
                    {guardedSeries.length > 0 ? (
                      <GuardedRankTrend series={guardedSeries[0]} />
                    ) : (
                      <div className="rounded-xl border border-dashed border-line bg-surface/50 px-4 py-8 text-center text-sm text-slate-500">
                        월보장 키워드를 등록하면 순위 추이가 표시됩니다.
                        <span className="mt-1 block text-xs text-slate-400">거래처 상세 · 키워드에서 &ldquo;순위 보장&rdquo; 설정</span>
                      </div>
                    )}
                  </div>
                </div>

                <GeoAutoWatch
                  clientId={selectedId}
                  configuredEngines={configuredEngines().map((e) => e.engine)}
                  monitorableCount={rows.filter((r) => r.status === "APPROVED" || r.status === "MONITORING").length}
                />
                <GeoMatrix clientId={selectedId} rows={rows} />

                {/* B2 레이더 + B4 언급현황 */}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-card p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">B2</span>
                      <h3 className="text-sm font-bold text-ink">AI 모델별 언급률</h3>
                    </div>
                    <p className="mb-3 text-[11px] text-slate-500">엔진별 분포 · 첫 관측 대비 현재</p>
                    <EngineRadar data={engineRadar} />
                  </div>
                  <div className="rounded-2xl border border-line bg-card p-4">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">B4</span>
                      <h3 className="text-sm font-bold text-ink">언급 현황 (우리 vs 경쟁사)</h3>
                    </div>
                    <p className="mb-3 text-[11px] text-slate-500">질문×엔진 최신 관측 기준 랭킹</p>
                    <MentionStanding rows={standing} />
                  </div>
                </div>

                {/* B3 질문별 언급률 추이 */}
                <div className="rounded-2xl border border-line bg-card p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-strong">B3</span>
                    <h3 className="text-sm font-bold text-ink">질문별 언급률 추이</h3>
                  </div>
                  <p className="mb-3 text-[11px] text-slate-500">각 측정질문의 AI 언급률 변화(질문당 한 선)</p>
                  <QuestionMentionTrend data={questionSeries} />
                </div>

                {/* B7 기회점수 + B10 전략 방향성 */}
                <GeoOpportunity score={oppScore} strategies={strategies} />

                {/* 월간 리포트 요약 */}
                <GeoMonthlyReport data={reportData} clientName={selectedName} />

                <SovChart sov={sov} />
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
        </>
      )}
    </section>
  );
}
