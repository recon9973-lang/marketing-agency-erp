import "server-only";
/**
 * 상권분석 리포트(마크다운) 생성기 — 내장 실측 데이터(행안부·심평원)만으로 결정형 작성.
 * location-auto 스킬의 리포트 스켈레톤을 ERP 상시 데이터로 재현. AI 없이 동작(날조 없음).
 *   · 출처 3등급(✅실측/🟡추정/🔴미실측) 표기  · 의료광고법 준수(효과·최상급 금지, KPI=목표치)
 */
import {
  getLocationInsight,
  getDemandBySpecialty,
  getOrientalDemand,
  getFrequentDiseases,
  getOpenings,
  getProvinceDemand,
  getDiseaseDemographics,
  nationalHospitalsPerTenThousand,
  type HospitalSummary,
  type RegionPopulation
} from "@/server/data/region-insight";

/** 상병(3단) 성별×연령 타깃 태그. 예: '여 62% · 30대'. 없으면 빈 문자열. */
function demoTag(code: string): string {
  const d = getDiseaseDemographics(code);
  if (!d) return "";
  const age = d.ageTop[0]?.band;
  return `여 ${d.femaleRatio ?? "—"}%${age ? ` · ${age}` : ""}`;
}

function frequentLines(specialty: string | null): string[] {
  const kind = specialty && ORIENTAL.has(specialty) ? "한방" : "전체";
  const { years, rows } = getFrequentDiseases(kind);
  if (!rows.length) return [];
  const out = [`## 전국 다빈도 상병 · 3년 추이 (${kind}) ✅실측`, `> 심평원 다빈도질병통계 ${years.latest} — 외래 환자수 상위·2년 증감률(${years.prev2}→${years.latest}) · 타깃=성별×연령.`, "", `| 상병 | ${years.latest} 환자수 | 추이 | 타깃 |`, `|---|---:|---:|---|`];
  rows.slice(0, 10).forEach((r) => out.push(`| ${r.code} ${r.name} | ${fmt(r.y0)} | ${r.trend == null ? "—" : `${r.trend >= 0 ? "▲" : "▼"}${Math.abs(r.trend)}%`} | ${demoTag(r.code)} |`));
  return out;
}

function provinceLines(sido: string): string[] {
  const rows = getProvinceDemand(sido);
  if (!rows.length) return [];
  const out = [`## ${sido} 지역 다빈도 상병 (양방·시도) ✅실측`, `> 심평원 시도별 진료통계(2024) — ${sido} 전 진료과 외래 환자수 상위 · 타깃=성별×연령.`, "", `| 상병 | 환자수 | 타깃 |`, `|---|---:|---|`];
  rows.slice(0, 12).forEach((r) => out.push(`| ${r.code} | ${fmt(r.patients)} | ${demoTag(r.code)} |`));
  return out;
}
import type { LocalPlace } from "@/server/integrations/naver-local";
import type { RegionDemographics } from "@/server/integrations/sgis";

/** 리포트에 덧붙일 실측 보강(연결된 소스: 네이버 경쟁사 · SGIS 연령·성별). */
export type ReportExtra = { competitors?: LocalPlace[]; demographics?: RegionDemographics | null };

const ORIENTAL = new Set(["한의원", "한방병원", "한방"]);

function demographicsLines(d: RegionDemographics | null | undefined): string[] {
  if (!d) return [];
  const out: string[] = [];
  if (d.genderResolved && d.female != null && d.male != null)
    out.push(`- 성별(SGIS): 남 ${fmt(d.male)} · 여 ${fmt(d.female)} (여성 ${d.femaleRatio ?? "—"}%) ✅실측`);
  if (d.ageResolved && d.ageBands.length)
    out.push(`- 연령대(SGIS): ${d.ageBands.map((b) => `${b.label} ${b.ratio}%`).join(" · ")} ✅실측`);
  if (d.femaleCore2039 != null)
    out.push(`- 20~30대 여성 코어(SGIS): ${fmt(d.femaleCore2039)}명 — 미용·다이어트 핵심 타깃 ✅실측`);
  return out;
}

function competitorLines(places: LocalPlace[] | undefined): string[] {
  if (!places || places.length === 0) return [];
  const out = [`## 경쟁사 상위 (네이버 지역검색 · 리뷰·언급순 표본)`, "", `| # | 상호 | 분류 | 주소 |`, `|---:|---|---|---|`];
  places.slice(0, 5).forEach((p, i) => out.push(`| ${i + 1} | ${p.name} | ${p.category} | ${p.roadAddress || p.address} |`));
  out.push("> 지역검색 API 상위 표본(최대 5, 개수 아님). 정밀 순위·리뷰수는 네이버 플레이스 별도 확인.");
  return out;
}

const KCD: Record<string, string> = {
  A09: "감염성 위장염", B01: "수두", E03: "갑상선기능저하", E11: "2형 당뇨", E66: "비만",
  E78: "고지혈증", F32: "우울에피소드", F41: "불안장애", G43: "편두통", H10: "결막염",
  H25: "노년백내장", I10: "고혈압", J00: "감기(급성비인두염)", J20: "급성기관지염", J30: "혈관운동성비염",
  K02: "치아우식(충치)", K05: "치은·치주질환", K21: "위식도역류", K29: "위염", L20: "아토피피부염",
  L30: "기타 피부염", L50: "두드러기", L70: "여드름", M54: "등·허리통증", M75: "어깨병변",
  N39: "요로계질환", R51: "두통", S93: "발목·발 염좌", Z00: "일반건강검진"
};

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}
function pct(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 1000) / 10 : 0;
}

export type MarketReport = {
  ok: boolean;
  region: string; // 해석된 라벨
  markdown: string;
  candidates?: { key: string; label: string }[];
  note?: string;
};

/** 규칙형 종합진단·전략 — 임계값 기반(추정은 🟡로 표기). */
function diagnose(pop: RegionPopulation | null, hos: HospitalSummary | null, nationalPer: number): string[] {
  const out: string[] = [];
  if (pop) {
    if (pop.femaleRatio != null && pop.femaleRatio >= 51)
      out.push(`여성 비중 ${pop.femaleRatio}%로 여초 지역 — 피부·성형·다이어트 등 여성 타깃 소구가 유효(🟡정성).`);
    if (pop.delta > 0) out.push(`전월 대비 인구 ▲${fmt(pop.delta)} — 유입 지역, 신규 수요 확보 여지(✅실측).`);
    else if (pop.delta < 0) out.push(`전월 대비 인구 ▼${fmt(Math.abs(pop.delta))} — 정체·감소 지역, 기존 고객 유지·리텐션 중심(✅실측).`);
  }
  if (hos) {
    if (hos.perTenThousand != null) {
      const ratio = nationalPer ? hos.perTenThousand / nationalPer : 1;
      if (ratio >= 1.2)
        out.push(`인구 만명당 ${hos.perTenThousand}개로 전국 평균(${nationalPer})보다 과밀 — 차별화·GEO/검색 상위 선점이 관건(✅실측).`);
      else if (ratio <= 0.8)
        out.push(`인구 만명당 ${hos.perTenThousand}개로 전국 평균(${nationalPer})보다 여유 — 공급 대비 수요 우위 가능성(✅실측).`);
      else out.push(`인구 만명당 ${hos.perTenThousand}개로 전국 평균(${nationalPer}) 수준의 경쟁 강도(✅실측).`);
    }
    if (hos.clinicToOriental != null)
      out.push(`의원:한의원 = ${hos.clinicToOriental}:1 — 양·한방 경쟁 구도. 검색 점유가 한방에 쏠렸다면 양방 마케팅 공백 기회(🟡정성).`);
  }
  if (!out.length) out.push("해석 가능한 데이터가 부족합니다. 지역·진료과를 확인하세요.");
  return out;
}

function strategy(specialty: string | null): string[] {
  const base = [
    "네이버 플레이스·블로그 상위 노출(검색 유입) + GEO(AI 답변 인용) 동시 트랙.",
    "지역 핵심 키워드 월보장 순위 관리 + 리뷰·후기 자산화.",
    "콘텐츠는 의료광고법 준수(전후사진·효과보장·최상급 표현 금지)."
  ];
  if (specialty) base.unshift(`${specialty} 실수요 상위 상병 기반 콘텐츠·질문 설계로 검색·AI 답변 선점.`);
  return base;
}

export function buildMarketReport(
  regionInput: string,
  specialty: string | null,
  brand?: string | null,
  extra: ReportExtra = {}
): MarketReport {
  const { resolve, population, hospitals } = getLocationInsight(regionInput);
  if (!resolve.key) {
    return {
      ok: false,
      region: resolve.label,
      markdown: "",
      candidates: resolve.candidates,
      note: resolve.candidates.length ? "지역이 모호합니다. 후보에서 선택하세요." : "지역을 찾지 못했습니다."
    };
  }
  const label = resolve.label;
  const demand = specialty ? getDemandBySpecialty(specialty) : [];
  const orientalD = specialty && ORIENTAL.has(specialty) && resolve.key ? getOrientalDemand(resolve.key) : null;
  const nationalPer = nationalHospitalsPerTenThousand();
  const now = new Date().toISOString().slice(0, 10);
  const client = brand?.trim() || "(일반형 · 병원명 자리)";

  const L: string[] = [];
  L.push(`# 상권분석 리포트 — ${label}${specialty ? ` · ${specialty}` : ""}`);
  L.push("");
  L.push(`- **대상**: ${client}`);
  L.push(`- **기준일**: ${now}`);
  L.push(`- **데이터**: 행안부 주민등록(2026.6) · 심평원 병원정보(2026.6) · 심평원 표시과목별 상병통계(2025)`);
  L.push(`- **표기**: ✅실측 · 🟡정성/추정 · 🔴미실측. KPI는 목표치(보장 아님), 의료광고법 준수.`);
  L.push("");

  // ① 인구
  L.push(`## 1. 인구 · 성별 ✅실측`);
  if (population) {
    L.push(`- 총인구 **${fmt(population.total)}명** (행정동 ${population.dongs}개) · 전월 증감 ${population.delta >= 0 ? "▲" : "▼"}${fmt(Math.abs(population.delta))}`);
    L.push(`- 남 ${fmt(population.male)} (${pct(population.male, population.total)}%) · 여 ${fmt(population.female)} (${population.femaleRatio ?? "—"}%)`);
  } else L.push("- 🔴 인구 데이터 없음");
  for (const line of demographicsLines(extra.demographics)) L.push(line);
  L.push("");

  // ② 병원 밀집도
  L.push(`## 2. 병원 밀집도 · 종별 ✅실측`);
  if (hospitals) {
    L.push(`- 전체 **${fmt(hospitals.total)}개** · 의원 ${fmt(hospitals.clinic)} · 치과의원 ${fmt(hospitals.dental)} · 한의원 ${fmt(hospitals.oriental)} · 병원급 ${fmt(hospitals.hospitalGrade)}`);
    if (hospitals.clinicToOriental != null) L.push(`- 의원:한의원 = **${hospitals.clinicToOriental}:1**`);
    if (hospitals.perTenThousand != null) L.push(`- 인구 만명당 **${hospitals.perTenThousand}개** (전국 평균 ${nationalPer})`);
    const op = resolve.key ? getOpenings(resolve.key) : null;
    if (op) L.push(`- 최근 개원: 1년 **${fmt(op.y1)}곳** · 3년 **${fmt(op.y3)}곳** — ${op.y1 >= 30 ? "신규 진입 활발(경쟁 심화)" : op.y1 <= 3 ? "신규 진입 적음(안정)" : "보통"} ✅실측`);
    L.push("");
    L.push(`| 종별 | 수 |`);
    L.push(`|---|---:|`);
    for (const [k, v] of Object.entries(hospitals.counts).sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${fmt(v)} |`);
  } else L.push("- 🔴 병원 데이터 없음");
  L.push("");

  // ③ 수요
  if (specialty) {
    L.push(`## 3. ${specialty} 수요 — 주상병 상위`);
    if (demand.length) {
      L.push(`> 심평원 표시과목별 상병통계 — 전국 ${specialty} 의원의 주상병별 연간 환자수(지역 아님, 실수요 구조) ✅실측`);
      L.push("");
      L.push(`| 순위 | 주상병 | 환자수 | 타깃(성·연령) |`);
      L.push(`|---:|---|---:|---|`);
      demand.slice(0, 12).forEach((d, i) => L.push(`| ${i + 1} | ${d.code} ${KCD[d.code] ?? ""} | ${fmt(d.patients)} | ${demoTag(d.code)} |`));
    } else if (ORIENTAL.has(specialty) && orientalD && orientalD.byDx.length) {
      L.push(`> 심평원 한방 진료통계(${orientalD.year}) — ${label} 한방기관 외래+입원 주상병(대분류)별 진료인원 ✅실측(지역)`);
      L.push("");
      L.push(`| 순위 | 주상병(대분류) | 진료인원 |`);
      L.push(`|---:|---|---:|`);
      orientalD.byDx.slice(0, 10).forEach((x, i) => L.push(`| ${i + 1} | ${x.dx} | ${fmt(x.patients)} |`));
      L.push(`- 지역 한방 총 진료인원 **${fmt(orientalD.total)}명**(${orientalD.year}). 근골격·통증 중심 수요 구조.`);
    } else if (ORIENTAL.has(specialty)) {
      L.push(`- 🔴 이 지역 한방 진료통계 없음(구 통합·명칭 변경 등으로 미매칭).`);
    } else L.push("- 🔴 해당 진료과 수요 데이터 없음");
    L.push("");
  }

  // 경쟁사(네이버 지역검색) — 연결 시 실측 표본
  for (const line of competitorLines(extra.competitors)) L.push(line);
  if (extra.competitors && extra.competitors.length) L.push("");

  // 지역(시도) 양방 다빈도 상병
  for (const line of provinceLines(resolve.key ? resolve.key.split("|")[0] : "")) L.push(line);
  L.push("");

  // 전국 다빈도 상병·3년 추이(전체/한방)
  for (const line of frequentLines(specialty)) L.push(line);
  L.push("");

  // ④ 종합진단 / 전략
  L.push(`## ${specialty ? 4 : 3}. 종합진단`);
  for (const d of diagnose(population, hospitals, nationalPer)) L.push(`- ${d}`);
  L.push("");
  L.push(`## ${specialty ? 5 : 4}. 전략 제안 (목표치 · 보장 아님)`);
  for (const s of strategy(specialty)) L.push(`- ${s}`);
  L.push("");

  // 부록 — 실제 포함된 소스에 따라 등급을 동적으로 표기
  const measured = ["인구·성별(행안부)", "병원 밀집도·종별(심평원)"];
  if (demand.length) measured.push("진료과 주상병 수요(심평원)");
  if (orientalD && orientalD.byDx.length) measured.push("한방 지역 주상병 수요(심평원)");
  measured.push("전국 다빈도 상병·3년 추이(심평원)");
  measured.push("양방 시도 다빈도 상병 + 상병별 성별×연령 타깃(심평원)");
  if (resolve.key && getOpenings(resolve.key)) measured.push("개원 추세(심평원 병원정보)");
  if (extra.demographics?.genderResolved || extra.demographics?.ageResolved) measured.push("연령×성별 코어(SGIS)");
  if (extra.competitors && extra.competitors.length) measured.push("경쟁사 상위 표본(네이버 지역검색)");
  const missing: string[] = ["양방 시군구 단위 진료인원(현재 시도 단위까지 보유)"];
  if (specialty && ORIENTAL.has(specialty) && !(orientalD && orientalD.byDx.length)) missing.push("이 지역 한방 진료통계 미매칭");
  if (!(extra.demographics?.genderResolved || extra.demographics?.ageResolved)) missing.push("연령×성별 코어(SGIS 미연동/미해결)");
  if (!(extra.competitors && extra.competitors.length)) missing.push("경쟁사 플레이스 순위·리뷰(네이버 미연동)");

  L.push(`## 부록 — 데이터 상태`);
  L.push(`- ✅실측: ${measured.join(", ")}`);
  L.push(`- 🟡정성: 타깃 소구·양한방 공백 등 해석`);
  L.push(`- 🔴미실측: ${missing.join(", ")}`);

  return { ok: true, region: label, markdown: L.join("\n") };
}

// 예산 배분(월 기준) — venomad-proposal STEP4 표준 채널 믹스(입력 예산에 비례).
const BUDGET_MIX: { channel: string; pct: number; role: string }[] = [
  { channel: "콘텐츠 제작(블로그·상세페이지)", pct: 40, role: "검색 유입·신뢰 자산" },
  { channel: "네이버 플레이스·검색광고", pct: 25, role: "지역 노출·전환" },
  { channel: "GEO·SEO(AI 답변·순위)", pct: 20, role: "장기 상위 선점" },
  { channel: "리뷰·후기·CRM 관리", pct: 15, role: "재방문·평판" }
];

/** 상권 실측 → 마케팅 제안서(마크다운). venomad-proposal 구조. KPI는 목표치(보장 아님). */
export function buildProposal(
  regionInput: string,
  specialty: string | null,
  brand?: string | null,
  monthlyBudgetManwon = 200,
  extra: ReportExtra = {}
): MarketReport {
  const { resolve, population, hospitals } = getLocationInsight(regionInput);
  if (!resolve.key) {
    return {
      ok: false,
      region: resolve.label,
      markdown: "",
      candidates: resolve.candidates,
      note: resolve.candidates.length ? "지역이 모호합니다. 후보에서 선택하세요." : "지역을 찾지 못했습니다."
    };
  }
  const label = resolve.label;
  const demand = specialty ? getDemandBySpecialty(specialty) : [];
  const nationalPer = nationalHospitalsPerTenThousand();
  const client = brand?.trim() || "(일반형 · 병원명 자리)";
  const now = new Date().toISOString().slice(0, 10);
  const budget = monthlyBudgetManwon > 0 ? monthlyBudgetManwon : 200;

  const L: string[] = [];
  L.push(`# 마케팅 제안서 — ${client}`);
  L.push("");
  L.push(`- **지역/분야**: ${label}${specialty ? ` · ${specialty}` : ""} · **기준일** ${now}`);
  L.push(`- 본 제안서의 성과 수치는 **목표치**이며 보장이 아닙니다. 의료광고법 준수(효과·최상급·전후 강조 금지).`);
  L.push("");

  L.push(`## 1. 현황 진단 (상권 실측)`);
  if (population) L.push(`- 상권 인구 ${fmt(population.total)}명 · 여성 ${population.femaleRatio ?? "—"}% · 전월 ${population.delta >= 0 ? "▲" : "▼"}${fmt(Math.abs(population.delta))}`);
  if (hospitals) {
    const per = hospitals.perTenThousand;
    const dense = per != null && nationalPer ? (per >= nationalPer * 1.2 ? "과밀" : per <= nationalPer * 0.8 ? "여유" : "평균") : "—";
    L.push(`- 경쟁 병·의원 ${fmt(hospitals.total)}개 · 만명당 ${per ?? "—"}(전국 ${nationalPer}, **${dense}**)`);
  }
  if (demand.length) L.push(`- ${specialty} 실수요 상위: ${demand.slice(0, 3).map((d) => `${d.code} ${KCD[d.code] ?? ""}`).join(" · ")}`);
  else if (specialty && ORIENTAL.has(specialty)) L.push(`- ⚠️ 한방 주상병 수요는 심평원 양방 상병통계에 없어 미반영(한방 진료통계 추가 시 실측).`);
  for (const line of demographicsLines(extra.demographics)) L.push(line);
  if (extra.competitors && extra.competitors.length)
    L.push(`- 경쟁사 상위(네이버): ${extra.competitors.slice(0, 5).map((p) => p.name).join(" · ")}`);
  L.push("");

  L.push(`## 2. 목표 (3개월 · 목표치)`);
  L.push(`- 지역 핵심 키워드 검색 상위 노출 · 네이버 플레이스 상위 진입`);
  L.push(`- AI 답변(GEO) 병원 언급률 상승 · 리뷰/후기 축적`);
  L.push("");

  L.push(`## 3. 전략 (채널 믹스)`);
  if (specialty) L.push(`- ${specialty} 실수요 상병 기반 콘텐츠·질문 설계로 검색·AI 답변 동시 공략`);
  L.push(`- 네이버 플레이스 최적화 + 블로그/상세페이지 자산화 + GEO 상위 선점 + 리뷰 관리`);
  L.push("");

  L.push(`## 4. 예산 배분 (월 ${budget}만원 기준)`);
  L.push(`| 채널 | 비중 | 월 예산 | 역할 |`);
  L.push(`|---|---:|---:|---|`);
  for (const m of BUDGET_MIX) L.push(`| ${m.channel} | ${m.pct}% | ${fmt(Math.round((budget * m.pct) / 100))}만 | ${m.role} |`);
  L.push(`| **합계** | **100%** | **${fmt(budget)}만** | |`);
  L.push("");

  L.push(`## 5. 기대효과 (목표치 · 보장 아님)`);
  L.push(`- 검색·지도 노출 확대 → 문의·예약 유입 증가`);
  L.push(`- AI 답변·검색 상위 선점으로 중장기 인지도·신뢰 강화`);
  L.push("");
  L.push(`> 상권 데이터 출처: 행안부 주민등록(2026.6) · 심평원 병원정보(2026.6)·상병통계(2025) ✅실측.`);

  return { ok: true, region: label, markdown: L.join("\n") };
}
