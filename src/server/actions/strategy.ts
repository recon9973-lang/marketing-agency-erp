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
import { buildJourneyFunnel, journeyFunnelMarkdown, type JourneyFunnel } from "@/server/market/journey-funnel";
import { runSeoAudit, scorePct, type SeoAuditOutcome } from "@/server/seo-engine";
import { searchLocalPlaces, naverLocalConfigured, type LocalPlace } from "@/server/integrations/naver-local";
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

/** 진료과 동종 필터 경쟁사 상위 표본. */
async function fetchCompetitors(label: string, specialty: string | null): Promise<StrategyCompetitors> {
  const q = `${label} ${specialty || ""}`.trim();
  if (!naverLocalConfigured()) return { configured: false, query: q, places: [] };
  const raw = await searchLocalPlaces(q, 5).catch(() => []);
  let places = raw;
  if (specialty) {
    const term = specialty.replace(/\s+/g, "");
    const same = raw.filter((p) => `${p.category}${p.name}`.replace(/\s+/g, "").includes(term));
    if (same.length > 0) places = same;
  }
  return { configured: true, query: q, places };
}

const fmt = (n: number | null | undefined): string => (n == null ? "—" : n.toLocaleString("ko-KR"));

/** 4개 실측 블록 → 통합 제안 브리프(마크다운). */
function buildBrief(s: {
  brand: string; label: string; specialty: string | null; date: string;
  acquisition: MarketingStrategy["acquisition"]; keywords: KeywordScan; journey: JourneyFunnel; seo: StrategySeo; compliance: StrategyCompliance; competitors: StrategyCompetitors;
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
    const [keywords, seoOutcome, competitors] = await Promise.all([
      scanKeywords(label, specialty),
      target ? runSeoAudit(target, seedKeyword).catch(() => null) : Promise.resolve(null),
      fetchCompetitors(label, specialty)
    ]);
    const seo = compactSeo(Boolean(target), seoOutcome);
    const compliance = scanCompliance(seoOutcome); // 홈페이지 텍스트 재활용 → 의료광고 위험

    const journey = buildJourneyFunnel(keywords.rows);
    const date = new Date().toISOString().slice(0, 10);
    const brief = buildBrief({ brand, label, specialty, date, acquisition, keywords, journey, seo, compliance, competitors });

    return { brand, regionLabel: label, specialty, resolved: Boolean(key), acquisition, keywords, journey, seo, compliance, competitors, brief };
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
