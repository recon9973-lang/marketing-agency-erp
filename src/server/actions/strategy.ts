"use server";

/**
 * 마케팅 전략 트랙 — 병원_검색여정·퍼널 기획서 계열.
 * 상권분석(트랙1)을 **입력 근거로 소비**해 다음을 한 판으로 낸다:
 *   ① 수주 진단(대응 방향)  ② 키워드 실측  ③ 홈페이지 검색·AI 노출 정밀진단  ④ 경쟁사  → 통합 브리프
 * ※ 상권분석과 별개 트랙. 상권 화면(/market)에는 전략 내용을 넣지 않는다.
 */
import { Prisma } from "@prisma/client";
import { runAction, type ActionResult } from "@/server/action-result";
import { requireUser } from "@/server/actions/_helpers";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import {
  getLocationInsight,
  getOpenings,
  nationalHospitalsPerTenThousand,
  getRegionIncome,
  getRegionAccess,
  getDemandBySpecialty
} from "@/server/data/region-insight";
import { buildScorecard } from "@/server/market/scorecard";
import { buildAcquisitionReview, consultingReviewMarkdown, type ConsultingReview } from "@/server/market/consulting-review";
import { scanKeywords, buildSeedKeywords, type KeywordScan } from "@/server/market/keyword-scan";
import { fetchBidEstimates } from "@/server/integrations/naver-search";
import { buildJourneyFunnel, journeyFunnelMarkdown, type JourneyFunnel } from "@/server/market/journey-funnel";
import { runSeoAudit, scorePct, type SeoAuditOutcome } from "@/server/seo-engine";
import { searchLocalPlaces, fetchBlogTop, naverLocalConfigured, type LocalPlace } from "@/server/integrations/naver-local";
import { selectCompetitors } from "@/server/market/competitor-filter";
import { checkMedicalLaw } from "@/server/compliance/medical-law";

export type StrategySeo = {
  attempted: boolean; // URL 입력해 진단 시도했는지
  ok: boolean;
  domain: string | null;
  score: number | null; // 0~100
  grade: string | null;
  categories: { label: string; pct: number; score: number; max: number }[];
  topFixes: { name: string; desc: string }[]; // 미충족 항목 + 처방(상위 6)
  version: string | null;
  fetchedWith: string | null;
  error: string | null;
};

export type StrategyCompetitors = { configured: boolean; query: string; places: LocalPlace[] };

export type StrategyBudget = {
  bidConnected: boolean; // 하나라도 실측 입찰가 확보(프로덕션·키 연결 시)
  measuredCount: number; // 실측 CPC 확보 키워드 수(0이면 예산 산출 불가)
  rows: { keyword: string; total: number | null; competition: string | null; cpc: number | null; measured: boolean }[];
  scenarios: { label: string; monthlyWon: number; note: string }[]; // 실측 CPC 있을 때만 채워짐(추정 금지)
};

export type ChannelSov = {
  configured: boolean; // 병원명 있고 조회 가능(프로스펙트 "(신규 병원)"이면 false)
  keyword: string | null; // 점유 판정 키워드(지역+진료과)
  channels: { channel: string; topN: number; ownSlots: number; ownRank: number | null }[];
};

export type StrategyCompliance = {
  scanned: boolean; // 홈페이지 텍스트를 실제 스캔했는지(URL·접근 성공 시)
  high: number;
  medium: number;
  flags: { label: string; severity: string; matched: string }[]; // 상위 표본
};

export type MarketingStrategy = {
  brand: string;
  regionLabel: string;
  specialty: string | null;
  resolved: boolean; // 상권 키 해결(상권 근거 확보) 여부
  acquisition: { review: ConsultingReview; markdown: string } | null; // 수주 진단·대응 방향
  keywords: KeywordScan; // 키워드 실측(검색량·경쟁·포화도)
  journey: JourneyFunnel; // 검색 여정·퍼널(키워드 의도 분류 → 채널·메시지·KPI)
  seo: StrategySeo; // 홈페이지 검색·AI 노출 정밀진단
  compliance: StrategyCompliance; // 홈페이지 의료광고법 위험 스캔
  competitors: StrategyCompetitors; // 경쟁사 상위 표본
  budget: StrategyBudget; // 파워링크 광고 예산 시나리오(CPC 입찰가)
  sov: ChannelSov; // 채널 점유(본원 vs 경쟁, 플레이스·블로그)
  brief: string; // 통합 제안 브리프(마크다운)
};

/** SEO 감사 outcome → 브리프·패널용 압축(단일 fetch 재활용). URL 없으면 attempted=false. */
function compactSeo(hasUrl: boolean, outcome: SeoAuditOutcome | null): StrategySeo {
  const empty = (over: Partial<StrategySeo>): StrategySeo => ({
    attempted: false, ok: false, domain: null, score: null, grade: null,
    categories: [], topFixes: [], version: null, fetchedWith: null, error: null, ...over
  });
  if (!hasUrl) return empty({});
  if (!outcome) return empty({ attempted: true, error: "ENGINE_ERROR" });
  if (!outcome.ok) return empty({ attempted: true, error: outcome.reason });
  const r = outcome.result;
  const categories = r.categories.map((c) => ({ label: c.label, pct: c.pct, score: c.score, max: c.max }));
  const topFixes = r.categories
    .flatMap((c) => c.items)
    .filter((it) => it.pass === false)
    .slice(0, 6)
    .map((it) => ({ name: it.name, desc: it.desc }));
  return {
    attempted: true, ok: true, domain: r.domain, score: scorePct(r), grade: r.grade?.label ?? null,
    categories, topFixes, version: r.version, fetchedWith: outcome.fetchedWith, error: null
  };
}

/** HTML → 가시 텍스트(스크립트·스타일·태그 제거). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 홈페이지 텍스트 → 의료광고법 위험 스캔(있으면). 거래처 금지어 있으면 함께 적용. */
function scanCompliance(outcome: SeoAuditOutcome | null, prohibited?: string | null): StrategyCompliance {
  if (!outcome || !outcome.ok || !outcome.html) return { scanned: false, high: 0, medium: 0, flags: [] };
  const text = htmlToText(outcome.html).slice(0, 40000); // 방어적 상한
  const r = checkMedicalLaw(text, prohibited ?? null);
  return {
    scanned: true,
    high: r.highCount,
    medium: r.mediumCount,
    flags: r.flags.slice(0, 14).map((f) => ({ label: f.label, severity: f.severity, matched: f.matched }))
  };
}

/** 진료과 관련 우선 정렬 + 자기병원·이종 제외 경쟁사 상위 표본(최대 5·네이버 API 상한). */
async function fetchCompetitors(label: string, specialty: string | null, brand: string | null = null): Promise<StrategyCompetitors> {
  const q = `${label} ${specialty || ""}`.trim();
  if (!naverLocalConfigured()) return { configured: false, query: q, places: [] };
  const raw = await searchLocalPlaces(q, 5).catch(() => []);
  return { configured: true, query: q, places: selectCompetitors(raw, { specialty, brand, limit: 5 }).places };
}

const fmt = (n: number | null | undefined): string => (n == null ? "—" : n.toLocaleString("ko-KR"));

/** 핵심 키워드 채널 점유(본원 vs 경쟁) — 플레이스·블로그 상위 노출 실측(덱 p6). 병원명 없으면 미조회. */
async function computeSov(brand: string, keyword: string | null): Promise<ChannelSov> {
  const b = brand.replace(/\s+/g, "");
  if (!b || b === "(신규병원)" || !keyword) return { configured: false, keyword, channels: [] };
  const [places, blogs] = await Promise.all([
    searchLocalPlaces(keyword, 5).catch(() => []),
    fetchBlogTop(keyword, 10).catch(() => [])
  ]);
  const placeRank = places.findIndex((p) => p.name.replace(/\s+/g, "").includes(b));
  const blogSlots = blogs.filter((x) => `${x.title}${x.bloggername}`.replace(/\s+/g, "").includes(b)).length;
  const channels = [
    { channel: "플레이스", topN: places.length || 5, ownSlots: placeRank >= 0 ? 1 : 0, ownRank: placeRank >= 0 ? placeRank + 1 : null },
    { channel: "블로그", topN: blogs.length || 10, ownSlots: blogSlots, ownRank: null }
  ];
  return { configured: naverLocalConfigured(), keyword, channels };
}

/**
 * 상위 키워드 + 네이버 검색광고 실측 입찰가 → 파워링크 예산 시나리오.
 * 정직성 원칙: CPC는 **실측 입찰가만** 사용한다. 추정치를 지어내지 않는다.
 * 실측 CPC가 하나도 없으면 시나리오는 산출하지 않는다(빈 배열 → UI가 미연결 안내).
 */
function buildBudget(rows: KeywordScan["rows"], bids: Map<string, number | null>): StrategyBudget {
  const top = rows.slice(0, 8);
  const brows = top.map((r) => {
    const measured = bids.get(r.keyword) ?? null;
    return { keyword: r.keyword, total: r.total, competition: r.competition, cpc: measured, measured: measured != null };
  });
  const measuredRows = brows.filter((r) => r.cpc != null);
  const measuredCount = measuredRows.length;
  // 실측 CPC가 없으면 예산 산출 불가(추정 금지) → 시나리오 비움.
  if (measuredCount === 0) {
    return { bidConnected: false, measuredCount: 0, rows: brows, scenarios: [] };
  }
  // 월 예산 = Σ(월검색량 × 목표 CTR × 실측 CPC). 실측된 키워드만 합산.
  const scen = (ctr: number) =>
    Math.round(measuredRows.reduce((s, r) => s + (r.total ?? 0) * ctr * (r.cpc as number), 0) / 10000) * 10000;
  const suffix = measuredCount < brows.length ? ` · 실측 ${measuredCount}개 키워드 기준` : "";
  const scenarios = [
    { label: "보수", monthlyWon: scen(0.02), note: `핵심 소수 키워드·중하위 노출${suffix}` },
    { label: "표준", monthlyWon: scen(0.04), note: `주요 키워드 상위 노출 유지${suffix}` },
    { label: "공격", monthlyWon: scen(0.07), note: `전 키워드 상단 점유 확대${suffix}` }
  ];
  return { bidConnected: true, measuredCount, rows: brows, scenarios };
}

/** 4개 실측 블록 → 통합 제안 브리프(마크다운). */
function buildBrief(s: {
  brand: string; label: string; specialty: string | null; date: string;
  acquisition: MarketingStrategy["acquisition"]; keywords: KeywordScan; journey: JourneyFunnel; seo: StrategySeo; compliance: StrategyCompliance; competitors: StrategyCompetitors; budget: StrategyBudget; sov: ChannelSov;
}): string {
  const L: string[] = [];
  L.push(`# 마케팅 전략 브리프 — ${s.brand}`);
  L.push("");
  L.push(`- 지역/진료 ${s.label}${s.specialty ? ` · ${s.specialty}` : ""} · 기준일 ${s.date}`);
  L.push("");
  // 1. 수주 진단
  const a = s.acquisition?.review;
  if (a) {
    L.push(`## 1. 수주 진단 — ${a.stage} (${a.overallScore}/100)`);
    L.push(`- ${a.headline}`);
    if (a.actions.length) {
      L.push(`- 대응 방향:`);
      a.actions.slice(0, 4).forEach((x, i) => L.push(`  ${i + 1}. ${x.title} — ${x.how}`));
    }
    L.push("");
  }
  // 2. 키워드 실측
  L.push(`## 2. 키워드 실측 (검색량·경쟁·포화도)`);
  if (s.keywords.rows.length) {
    L.push(`| 키워드 | 검색수(합) | 경쟁도 | 블로그 | 포화도 |`);
    L.push(`|---|---:|:--:|---:|:--:|`);
    s.keywords.rows.slice(0, 10).forEach((r) =>
      L.push(`| ${r.keyword} | ${fmt(r.total)} | ${r.competition ?? "—"} | ${fmt(r.blogDocs)} | ${r.saturation ?? "—"} |`));
    if (!s.keywords.searchConnected) L.push(`> ⚠️ 검색량 미연동(데모) — NAVER_AD 키 연결 시 실측.`);
  } else L.push(`- 키워드 결과 없음(진료과 선택 시 정확도 상승).`);
  L.push("");
  // 3. 홈페이지 검색·AI 노출
  L.push(`## 3. 홈페이지 검색·AI 노출 (정밀진단)`);
  if (!s.seo.attempted) L.push(`- 홈페이지 URL 미입력 — 있으면 SEO·GEO 점수·처방 실측. 없으면 플레이스·블로그 중심 전략.`);
  else if (!s.seo.ok) L.push(`- ⚠️ 진단 실패(${s.seo.error}). URL·접근성 확인.`);
  else {
    L.push(`- **${s.seo.score}/100 (${s.seo.grade})** · ${s.seo.domain} · 엔진 ${s.seo.version}`);
    L.push(`- 부문: ${s.seo.categories.map((c) => `${c.label} ${c.pct}%`).join(" · ")}`);
    if (s.seo.topFixes.length) {
      L.push(`- 개선 우선순위:`);
      s.seo.topFixes.forEach((f) => L.push(`  - ${f.name}: ${f.desc}`));
    }
  }
  L.push("");
  // 4. 경쟁사
  L.push(`## 4. 경쟁사 상위 표본 (네이버 지역검색)`);
  if (!s.competitors.configured) L.push(`- 네이버 지역검색 미연동.`);
  else if (s.competitors.places.length) s.competitors.places.forEach((p, i) => L.push(`${i + 1}. ${p.name} — ${p.category} · ${p.roadAddress || p.address}`));
  else L.push(`- 표본 없음.`);
  L.push("");
  // 5. 검색 여정·퍼널
  L.push(journeyFunnelMarkdown(s.journey));
  L.push("");
  // 6. 의료광고 리스크(홈페이지 스캔)
  L.push(`## 6. 의료광고 리스크 (홈페이지 스캔)`);
  if (!s.compliance.scanned) L.push(`- 홈페이지 미스캔(URL 없음/접근 실패) — URL 입력 시 의료법 §56 위험 표현 자동 점검.`);
  else if (s.compliance.high + s.compliance.medium === 0) L.push(`- ✅ 위험 표현 미검출(자동 1차). 최종 게시 전 내부·전문 검토는 별도 유지.`);
  else {
    L.push(`- ⚠️ 위험 표현 **높음 ${s.compliance.high} · 중간 ${s.compliance.medium}** — 계약·심의 전 수정 권고.`);
    s.compliance.flags.slice(0, 10).forEach((f) => L.push(`  - [${f.severity === "high" ? "높음" : "중간"}] ${f.label}: "${f.matched}"`));
  }
  L.push("");
  // 7. 광고 예산 시나리오
  L.push(`## 7. 광고 예산 시나리오 (파워링크)`);
  if (s.budget.bidConnected) {
    L.push(`> CPC 실측(네이버 검색광고 입찰가) · 예산=월검색량×CTR×CPC 가늠(실집행 전 참고).`);
    L.push(`| 키워드 | 월검색수 | 경쟁 | CPC(원, 실측) |`);
    L.push(`|---|---:|:--:|---:|`);
    s.budget.rows.forEach((r) => L.push(`| ${r.keyword} | ${fmt(r.total)} | ${r.competition ?? "—"} | ${r.cpc == null ? "미조회" : fmt(r.cpc)} |`));
    L.push(`- 월 예산 가늠: ${s.budget.scenarios.map((sc) => `${sc.label} ${Math.round(sc.monthlyWon / 10000).toLocaleString("ko-KR")}만`).join(" · ")}${s.budget.measuredCount < s.budget.rows.length ? ` (실측 ${s.budget.measuredCount}개 키워드 기준)` : ""}`);
  } else {
    L.push(`> ⚠️ 네이버 검색광고 API 미연결 — CPC 실측 입찰가를 확보하지 못해 예산 시나리오는 산출하지 않습니다(추정치 사용 안 함).`);
    L.push(`| 키워드 | 월검색수 | 경쟁 |`);
    L.push(`|---|---:|:--:|`);
    s.budget.rows.forEach((r) => L.push(`| ${r.keyword} | ${fmt(r.total)} | ${r.competition ?? "—"} |`));
    L.push(`- NAVER_AD_API_KEY·SECRET·CUSTOMER_ID 연결 시 실측 입찰가 기반 예산이 자동 산출됩니다.`);
  }
  L.push("");
  // 8. 채널 점유(본원 vs 경쟁)
  L.push(`## 8. 채널 점유 — 본원 vs 경쟁${s.sov.keyword ? ` (‘${s.sov.keyword}’)` : ""}`);
  if (!s.sov.configured) L.push(`- 병원명 미입력 — 병원명을 넣으면 플레이스·블로그 상위에 본원 노출 여부를 실측합니다.`);
  else {
    s.sov.channels.forEach((c) => {
      const own = c.ownSlots > 0 ? `본원 노출(${c.ownRank ? `${c.ownRank}위` : `상위 ${c.ownSlots}건`})` : "본원 미노출";
      L.push(`- ${c.channel}: ${own} · 상위 ${c.topN}건 중 경쟁 ${Math.max(0, c.topN - c.ownSlots)}건`);
    });
    L.push(`- → 미노출 채널이 진입 우선순위(경쟁이 점유 중인 지점).`);
  }
  L.push("");
  L.push(`> 실측 근거 기반. 수치는 목표·해석이며 성과 보장이 아님. 의료광고법 준수(전후사진·최상급·효과보장 금지). 위험 스캔은 1차 필터이며 심의 통과를 보장하지 않음.`);
  return L.join("\n");
}

/** 병원+지역+진료과(+URL) → 마케팅 전략(수주 진단 + 키워드 + 정밀진단 + 경쟁사 + 통합 브리프). */
export async function analyzeMarketingStrategy(input: {
  brand?: string | null;
  region: string;
  specialty?: string | null;
  url?: string | null;
}): Promise<ActionResult<MarketingStrategy>> {
  return runAction(async (): Promise<MarketingStrategy> => {
    await requireUser();
    const specialty = input.specialty?.trim() || null;
    const brand = input.brand?.trim() || "(신규 병원)";
    const { resolve, population, hospitals } = getLocationInsight((input.region ?? "").trim());
    const label = resolve.key ? resolve.label : (input.region ?? "").trim();
    const nationalPer = nationalHospitalsPerTenThousand();
    const key = resolve.key;

    const scorecard = key ? buildScorecard({ population, hospitals, openings: getOpenings(key), nationalPer }) : null;
    const openings = key ? getOpenings(key) : null;
    const income = key ? getRegionIncome(key.split("|")[0]) : null;
    const access = key ? getRegionAccess(key) : null;
    const demand = specialty ? getDemandBySpecialty(specialty) : [];
    const seedKeyword = buildSeedKeywords(label, specialty)[0] ?? null;

    let acquisition: MarketingStrategy["acquisition"] = null;
    if (key) {
      const review = buildAcquisitionReview({
        hospitalName: brand,
        region: label,
        specialty,
        populationTotal: population?.total ?? null,
        femaleRatio: population?.femaleRatio ?? null,
        populationDelta: population?.delta ?? null,
        perTenThousand: hospitals?.perTenThousand ?? null,
        nationalPer,
        openingsY1: openings?.y1 ?? null,
        scoreGrade: scorecard?.grade ?? null,
        scoreOverall: scorecard?.overall ?? null,
        incomeIndex: income?.index ?? null,
        accessLevel: access?.level ?? null,
        accessLabel: access?.label ?? null,
        demandRows: demand.length
      });
      const markdown = consultingReviewMarkdown(review, {
        region: label,
        departments: specialty ? [specialty] : [],
        date: new Date().toISOString().slice(0, 10),
        title: "신규 수주 진단"
      });
      acquisition = { review, markdown };
    }

    // 병렬 실측: 키워드 · 정밀진단(1회 fetch) · 경쟁사
    const target = (input.url ?? "").trim();
    const [keywords, seoOutcome, competitors, sov] = await Promise.all([
      scanKeywords(label, specialty),
      target ? runSeoAudit(target, seedKeyword).catch(() => null) : Promise.resolve(null),
      fetchCompetitors(label, specialty, input.brand?.trim() || null),
      computeSov(brand, seedKeyword)
    ]);
    const seo = compactSeo(Boolean(target), seoOutcome);
    const compliance = scanCompliance(seoOutcome); // 홈페이지 텍스트 재활용 → 의료광고 위험

    const journey = buildJourneyFunnel(keywords.rows);
    // 예산: 상위 키워드 입찰가(실측 시도) → 파워링크 예산 시나리오.
    const bids = await fetchBidEstimates(keywords.rows.slice(0, 8).map((r) => r.keyword)).catch(() => new Map<string, number | null>());
    const budget = buildBudget(keywords.rows, bids);

    const date = new Date().toISOString().slice(0, 10);
    const brief = buildBrief({ brand, label, specialty, date, acquisition, keywords, journey, seo, compliance, competitors, budget, sov });

    return { brand, regionLabel: label, specialty, resolved: Boolean(key), acquisition, keywords, journey, seo, compliance, competitors, budget, sov, brief };
  });
}

// 전략 트랙 저장 리포트 = clientId·leadId 모두 null(프로스펙트). 이 판별자로 목록/조회.
export type StrategyReportListItem = {
  id: string;
  hospitalName: string;
  address: string | null;
  departments: string | null;
  summary: string | null;
  status: string;
  createdAt: string;
};
export type StrategyReportFull = StrategyReportListItem & { brief: string | null; competitors: string | null };

/** 전략 트랙에서 저장한 상담 리포트 최근 목록. */
export async function listStrategyReports(limit = 20): Promise<ActionResult<StrategyReportListItem[]>> {
  return runAction(async (): Promise<StrategyReportListItem[]> => {
    await requireUser();
    const orgId = await getDefaultOrgId();
    const rows = await db.consultingReport.findMany({
      where: { clientId: null, leadId: null, orgId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
      select: { id: true, hospitalName: true, address: true, departments: true, summary: true, status: true, createdAt: true }
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  });
}

/** 저장된 전략 상담 리포트 상세(브리프 전문). */
export async function getStrategyReport(id: string): Promise<ActionResult<StrategyReportFull>> {
  return runAction(async (): Promise<StrategyReportFull> => {
    await requireUser();
    const orgId = await getDefaultOrgId();
    const r = await db.consultingReport.findFirst({
      where: { id: id.trim(), orgId },
      select: { id: true, hospitalName: true, address: true, departments: true, summary: true, status: true, createdAt: true, marketAnalysis: true, competitors: true }
    });
    if (!r) throw new Error("리포트를 찾을 수 없습니다.");
    return {
      id: r.id, hospitalName: r.hospitalName, address: r.address, departments: r.departments,
      summary: r.summary, status: r.status, createdAt: r.createdAt.toISOString(),
      brief: r.marketAnalysis, competitors: typeof r.competitors === "string" ? r.competitors : null
    };
  });
}

/** 전략 저장 리포트 상태 전환(DRAFT↔SHARED). 전략 저장분(clientId·leadId null)만. */
export async function updateStrategyReportStatus(id: string, status: "DRAFT" | "SHARED"): Promise<ActionResult<{ ok: true }>> {
  return runAction(async (): Promise<{ ok: true }> => {
    await requireUser();
    const orgId = await getDefaultOrgId();
    const r = await db.consultingReport.updateMany({
      where: { id: id.trim(), orgId, clientId: null, leadId: null },
      data: { status }
    });
    if (r.count === 0) throw new Error("리포트를 찾을 수 없습니다.");
    return { ok: true as const };
  });
}

/** 전략 저장 리포트 삭제. 전략 저장분(clientId·leadId null)만 — 리드/거래처 컨설팅은 보호. */
export async function deleteStrategyReport(id: string): Promise<ActionResult<{ ok: true }>> {
  return runAction(async (): Promise<{ ok: true }> => {
    await requireUser();
    const orgId = await getDefaultOrgId();
    const r = await db.consultingReport.deleteMany({
      where: { id: id.trim(), orgId, clientId: null, leadId: null }
    });
    if (r.count === 0) throw new Error("리포트를 찾을 수 없습니다.");
    return { ok: true as const };
  });
}

/** 마케팅 전략 결과를 상담 리포트(ConsultingReport)로 저장 — 상담 이력·재조회. clientId 있으면 연결. */
export async function saveStrategyReport(input: {
  brand: string;
  region: string;
  specialty?: string | null;
  brief: string;
  summary?: string | null;
  keywords?: unknown;
  competitors?: string | null;
  clientId?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  return runAction(async (): Promise<{ id: string }> => {
    const user = await requireUser();
    const brief = (input.brief ?? "").trim();
    if (!brief) throw new Error("빈 브리프는 저장할 수 없습니다.");
    const orgId = await getDefaultOrgId();
    const report = await db.consultingReport.create({
      data: {
        clientId: input.clientId?.trim() || null,
        authorId: user.id,
        hospitalName: input.brand?.trim() || "(신규 병원)",
        address: input.region?.trim() || null,
        departments: input.specialty?.trim() || null,
        keywords: (Array.isArray(input.keywords) ? input.keywords : []) as Prisma.InputJsonValue,
        competitors: input.competitors?.trim() ? input.competitors.trim() : Prisma.JsonNull,
        marketAnalysis: brief,
        summary: input.summary?.trim() || null,
        status: "DRAFT",
        orgId
      }
    });
    return { id: report.id };
  });
}
