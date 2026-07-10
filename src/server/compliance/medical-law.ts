// 목표 경로: src/server/compliance/medical-law.ts
//
// 의료광고법(의료법 제56조) 위험 표현 규칙엔진.
// AI 판단 이전의 1차 필터 — 금지어 사전/패턴으로 위험 문구를 표시한다.
// 원칙: 이 엔진은 "위험 표시"만 하고, 최종 승인은 사람이 한다.

export type RiskSeverity = "high" | "medium";
export type MedicalLawType = {
  code: number; // 의료법 §56 유형 번호
  key: string;
  label: string;
  severity: RiskSeverity;
  patterns: RegExp[];
};

// 각 패턴은 대소문자 무시. 한글 위주라 단어경계 대신 부분일치.
const T = (s: string) => new RegExp(s, "gi");

export const MEDICAL_LAW_TYPES: MedicalLawType[] = [
  {
    code: 8,
    key: "superlative",
    label: "과장·최상급 표현",
    severity: "high",
    patterns: [T("최고"), T("최초"), T("유일"), T("최상"), T("1위"), T("No\\.?1"), T("넘버원"), T("완벽"), T("100%"), T("최저가"), T("가장\\s*좋은")]
  },
  {
    code: 8,
    key: "cure_guarantee",
    label: "치료효과 보장·완치 암시",
    severity: "high",
    patterns: [T("완치"), T("완전\\s*치료"), T("무조건"), T("반드시\\s*낫"), T("재발\\s*없"), T("부작용\\s*(이|은)?\\s*없"), T("100%\\s*효과"), T("확실히\\s*낫")]
  },
  {
    code: 2,
    key: "testimonial",
    label: "치료경험담·후기성 표현",
    severity: "high",
    patterns: [T("후기"), T("체험담"), T("경험담"), T("효과\\s*(를)?\\s*봤"), T("치료\\s*받고\\s*좋아"), T("추천합니다"), T("만족했")]
  },
  {
    code: 13,
    key: "discount",
    label: "비급여 할인·이벤트 유인",
    severity: "high",
    patterns: [T("할인"), T("이벤트"), T("무료"), T("공짜"), T("[0-9]+\\s*원"), T("[0-9]+\\s*%\\s*(할인|off)"), T("특가"), T("반값"), T("사은품"), T("증정")]
  },
  {
    code: 4,
    key: "comparison",
    label: "비교 광고",
    severity: "medium",
    patterns: [T("타\\s*병원\\s*보다"), T("다른\\s*병원\\s*보다"), T("보다\\s*우수"), T("보다\\s*뛰어")]
  },
  {
    code: 14,
    key: "endorsement",
    label: "인증·보증·추천·수상",
    severity: "medium",
    patterns: [T("인증"), T("보증"), T("공식\\s*추천"), T("대상\\s*수상"), T("1등\\s*선정"), T("보건복지부\\s*인증")]
  },
  {
    code: 9,
    key: "authority",
    label: "근거 없는 명의·권위 표방",
    severity: "medium",
    patterns: [T("명의"), T("권위자"), T("대한민국\\s*대표"), T("최고\\s*권위")]
  },
  {
    code: 10,
    key: "article",
    label: "기사·전문가 의견형 광고",
    severity: "medium",
    patterns: [T("기자"), T("취재"), T("보도자료"), T("인터뷰\\s*기사")]
  },
  {
    code: 12,
    key: "foreigner",
    label: "외국인환자 유치 국내광고",
    severity: "medium",
    patterns: [T("외국인\\s*환자\\s*유치")]
  }
];

export type ComplianceFlag = {
  type: string; // key
  label: string;
  code: number;
  severity: RiskSeverity;
  matched: string;
};

export type ComplianceResult = {
  flags: ComplianceFlag[];
  highCount: number;
  mediumCount: number;
};

// 거래처 금지어(prohibitedClaims)를 패턴으로. 쉼표/줄바꿈 구분.
function clientProhibitedPatterns(prohibited?: string | null): { label: string; re: RegExp }[] {
  if (!prohibited) return [];
  return prohibited
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .map((s) => ({ label: s, re: new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") }));
}

/** 텍스트를 의료법 위험 유형으로 검사. 거래처 금지어도 함께 적용. */
export function checkMedicalLaw(text: string, prohibitedClaims?: string | null): ComplianceResult {
  const flags: ComplianceFlag[] = [];
  const seen = new Set<string>();

  for (const type of MEDICAL_LAW_TYPES) {
    for (const re of type.patterns) {
      for (const m of text.matchAll(re)) {
        const matched = m[0];
        const dedupe = `${type.key}:${matched}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        flags.push({ type: type.key, label: type.label, code: type.code, severity: type.severity, matched });
      }
    }
  }

  // 거래처 지정 금지어 — 항상 high.
  for (const p of clientProhibitedPatterns(prohibitedClaims)) {
    for (const m of text.matchAll(p.re)) {
      const dedupe = `custom:${m[0]}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      flags.push({ type: "custom", label: "거래처 지정 금지어", code: 0, severity: "high", matched: m[0] });
    }
  }

  return {
    flags,
    highCount: flags.filter((f) => f.severity === "high").length,
    mediumCount: flags.filter((f) => f.severity === "medium").length
  };
}
