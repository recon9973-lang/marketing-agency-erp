import "server-only";
/**
 * 진료과별 타깃 인구 프로파일 — 진료과마다 중요한 연령·성별 세그먼트와 핵심 지표 커버리지.
 * SGIS 연령·성별 실측으로 "이 진료과 핵심 타깃 거주인구"를 산출하고, rubric 지표의
 * 보유/미보유를 정직하게 표시한다(소득·접근성 등 없는 축은 🔴).
 */
import type { RegionDemographics } from "@/server/integrations/sgis";

export type FactorStatus = "have" | "partial" | "missing";
export type ProfileFactor = { label: string; status: FactorStatus };
type ProfileDef = {
  targetLabel: string; // 사람이 읽는 타깃 세그먼트
  ageBands: string[]; // 합산할 SGIS 연령대 라벨(10대이하/20대/30대/40대/50대/60대+)
  useFemaleCore?: boolean; // 20~30대 여성 코어 사용(산부인과 등)
  factors: ProfileFactor[]; // rubric 핵심 지표 커버리지
};

const HAVE_COMPETE: ProfileFactor = { label: "경쟁 병·의원 밀도", status: "have" };

const PROFILES: Record<string, ProfileDef> = {
  소아청소년과: {
    targetLabel: "0~14세 아동(≈10대이하)",
    ageBands: ["10대이하"],
    factors: [
      { label: "0~14세 인구", status: "partial" },
      { label: "출생아 수", status: "missing" },
      { label: "어린이집·학교", status: "missing" },
      { label: "신축 아파트", status: "missing" },
      HAVE_COMPETE
    ]
  },
  산부인과: {
    targetLabel: "20~44세 여성",
    ageBands: ["20대", "30대", "40대"],
    useFemaleCore: true,
    factors: [
      { label: "20~44세 여성", status: "partial" },
      { label: "출생·혼인", status: "missing" },
      { label: "직장여성", status: "missing" },
      { label: "산후조리원", status: "missing" },
      HAVE_COMPETE
    ]
  },
  정형외과: {
    targetLabel: "고령(60대+)·직장인구",
    ageBands: ["50대", "60대+"],
    factors: [
      { label: "고령인구", status: "partial" },
      { label: "직장인구", status: "missing" },
      { label: "산업단지", status: "missing" },
      { label: "스포츠시설", status: "missing" },
      HAVE_COMPETE
    ]
  },
  재활의학과: {
    targetLabel: "고령(60대+)·직장인구",
    ageBands: ["50대", "60대+"],
    factors: [
      { label: "고령인구", status: "partial" },
      { label: "직장인구", status: "missing" },
      { label: "산업단지", status: "missing" },
      { label: "의료 이용통계", status: "have" },
      HAVE_COMPETE
    ]
  },
  내과: {
    targetLabel: "40세 이상 거주인구",
    ageBands: ["40대", "50대", "60대+"],
    factors: [
      { label: "40+ 거주인구", status: "partial" },
      { label: "만성질환 통계", status: "have" },
      { label: "직장인구", status: "missing" },
      HAVE_COMPETE
    ]
  },
  피부과: {
    targetLabel: "20~40대 생활인구",
    ageBands: ["20대", "30대", "40대"],
    factors: [
      { label: "20~40대 인구", status: "partial" },
      { label: "소득", status: "missing" },
      { label: "카드소비", status: "missing" },
      { label: "광역 접근성", status: "missing" },
      { label: "검색량(네이버)", status: "have" }
    ]
  },
  성형외과: {
    targetLabel: "20~40대 생활인구",
    ageBands: ["20대", "30대", "40대"],
    factors: [
      { label: "20~40대 인구", status: "partial" },
      { label: "소득", status: "missing" },
      { label: "카드소비", status: "missing" },
      { label: "광역 접근성", status: "missing" },
      { label: "검색량(네이버)", status: "have" }
    ]
  },
  안과: {
    targetLabel: "연령별(고령 백내장·저연령 근시)",
    ageBands: ["10대이하", "60대+"],
    factors: [
      { label: "연령별 거주인구", status: "partial" },
      { label: "계절성", status: "partial" },
      HAVE_COMPETE
    ]
  },
  이비인후과: {
    targetLabel: "전연령(계절성 강)",
    ageBands: ["10대이하", "20대", "30대"],
    factors: [
      { label: "연령별 거주인구", status: "partial" },
      { label: "계절성", status: "partial" },
      HAVE_COMPETE
    ]
  },
  치과: {
    targetLabel: "거주·가족가구(30~50대)",
    ageBands: ["30대", "40대", "50대"],
    factors: [
      { label: "거주인구", status: "have" },
      { label: "직장인구", status: "missing" },
      { label: "가족가구", status: "missing" },
      { label: "소득", status: "missing" },
      { label: "경쟁 치과 밀도", status: "have" }
    ]
  },
  한의원: {
    targetLabel: "통증·고령층(40대+)",
    ageBands: ["40대", "50대", "60대+"],
    factors: [
      { label: "통증·고령층", status: "partial" },
      { label: "한방 지역 수요", status: "have" },
      { label: "경쟁 한의원 밀도", status: "have" }
    ]
  },
  한방병원: {
    targetLabel: "통증·고령층(40대+)",
    ageBands: ["40대", "50대", "60대+"],
    factors: [
      { label: "통증·고령층", status: "partial" },
      { label: "한방 지역 수요", status: "have" },
      { label: "경쟁 한방 밀도", status: "have" }
    ]
  },
  요양병원: {
    targetLabel: "65세 이상 고령(≈60대+)",
    ageBands: ["60대+"],
    factors: [
      { label: "65+ 인구", status: "partial" },
      { label: "장기요양 인정자", status: "missing" },
      { label: "보호자 접근성", status: "missing" },
      { label: "경쟁 요양병원", status: "have" }
    ]
  }
};

export type SpecialtyProfile = {
  specialty: string;
  targetLabel: string;
  targetCount: number | null; // 타깃 세그먼트 거주인구(SGIS 연령 실측 시)
  targetShare: number | null; // 총인구 대비 %
  factors: ProfileFactor[];
  hasAge: boolean; // SGIS 연령 실측 여부
};

/** 진료과 + SGIS 연령·성별 → 타깃 인구 프로파일. 매핑 없으면 null. */
export function buildSpecialtyProfile(specialty: string | null, demo: RegionDemographics | null): SpecialtyProfile | null {
  if (!specialty) return null;
  const def = PROFILES[specialty];
  if (!def) return null;
  let targetCount: number | null = null;
  let targetShare: number | null = null;
  if (demo?.ageResolved && demo.ageBands.length) {
    if (def.useFemaleCore && demo.femaleCore2039 != null) {
      targetCount = demo.femaleCore2039;
    } else {
      targetCount = def.ageBands.reduce((sum, b) => sum + (demo.ageBands.find((x) => x.label === b)?.population ?? 0), 0);
    }
    if (demo.total) targetShare = Math.round((targetCount / demo.total) * 1000) / 10;
  }
  return {
    specialty,
    targetLabel: def.targetLabel,
    targetCount,
    targetShare,
    factors: def.factors,
    hasAge: Boolean(demo?.ageResolved)
  };
}
