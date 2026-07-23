import "server-only";
/**
 * 상권분석 리포트(마크다운) 생성기 — 내장 실측 데이터(행안부·심평원)만으로 결정형 작성.
 * location-auto 스킬의 리포트 스켈레톤을 ERP 상시 데이터로 재현. AI 없이 동작(날조 없음).
 *   · 출처 3등급(✅실측/🟡추정/🔴미실측) 표기  · 의료광고법 준수(효과·최상급 금지, KPI=목표치)
 */
import {
  getLocationInsight,
  getDemandBySpecialty,
  nationalHospitalsPerTenThousand,
  type HospitalSummary,
  type RegionPopulation
} from "@/server/data/region-insight";

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

export function buildMarketReport(regionInput: string, specialty: string | null, brand?: string | null): MarketReport {
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
  L.push("");

  // ② 병원 밀집도
  L.push(`## 2. 병원 밀집도 · 종별 ✅실측`);
  if (hospitals) {
    L.push(`- 전체 **${fmt(hospitals.total)}개** · 의원 ${fmt(hospitals.clinic)} · 치과의원 ${fmt(hospitals.dental)} · 한의원 ${fmt(hospitals.oriental)} · 병원급 ${fmt(hospitals.hospitalGrade)}`);
    if (hospitals.clinicToOriental != null) L.push(`- 의원:한의원 = **${hospitals.clinicToOriental}:1**`);
    if (hospitals.perTenThousand != null) L.push(`- 인구 만명당 **${hospitals.perTenThousand}개** (전국 평균 ${nationalPer})`);
    L.push("");
    L.push(`| 종별 | 수 |`);
    L.push(`|---|---:|`);
    for (const [k, v] of Object.entries(hospitals.counts).sort((a, b) => b[1] - a[1])) L.push(`| ${k} | ${fmt(v)} |`);
  } else L.push("- 🔴 병원 데이터 없음");
  L.push("");

  // ③ 수요
  if (specialty) {
    L.push(`## 3. ${specialty} 수요 — 주상병 상위 ✅실측(전국)`);
    L.push(`> 심평원 표시과목별 상병통계 — 전국 ${specialty} 의원의 주상병별 연간 환자수(지역 아님, 실수요 구조).`);
    L.push("");
    if (demand.length) {
      L.push(`| 순위 | 주상병 | 환자수 |`);
      L.push(`|---:|---|---:|`);
      demand.slice(0, 12).forEach((d, i) => L.push(`| ${i + 1} | ${d.code} ${KCD[d.code] ?? ""} | ${fmt(d.patients)} |`));
    } else L.push("- 🔴 해당 진료과 수요 데이터 없음");
    L.push("");
  }

  // ④ 종합진단 / 전략
  L.push(`## ${specialty ? 4 : 3}. 종합진단`);
  for (const d of diagnose(population, hospitals, nationalPer)) L.push(`- ${d}`);
  L.push("");
  L.push(`## ${specialty ? 5 : 4}. 전략 제안 (목표치 · 보장 아님)`);
  for (const s of strategy(specialty)) L.push(`- ${s}`);
  L.push("");

  // 부록
  L.push(`## 부록 — 데이터 상태`);
  L.push(`- ✅실측: 인구·성별(행안부), 병원 밀집도·종별(심평원), 진료과 주상병 수요(심평원)`);
  L.push(`- 🟡정성: 타깃 소구·양한방 공백 등 해석`);
  L.push(`- 🔴미실측: 지역별 진료인원, 경쟁사 플레이스 순위·리뷰(네이버 지역검색 별도), 연령×성별 코어(SGIS 키 연동 시)`);

  return { ok: true, region: label, markdown: L.join("\n") };
}
