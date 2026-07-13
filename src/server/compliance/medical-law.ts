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
    patterns: [T("후기"), T("체험담"), T("경험담"), T("효과\\s*(를)?\\s*봤"), T("치료\\s*받고\\s*좋아"), T("추천합니다"), T("만족했"), T("전\\s*후\\s*(사진|비교)"), T("비포\\s*[-·]?\\s*애프터"), T("before\\s*[-/&]?\\s*after")]
  },
  {
    code: 13,
    key: "discount",
    label: "비급여 할인·이벤트 유인",
    severity: "high",
    patterns: [T("할인"), T("이벤트"), T("무료"), T("공짜"), T("[0-9]+\\s*원"), T("[0-9]+\\s*%\\s*(할인|off)"), T("특가"), T("반값"), T("사은품"), T("증정"), T("선착순")]
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

// ── 성과 보장성 문구 검사 (기획서 §9 성과표현·§15) ─────────────────────────
// 의료법 §56과 별개의 리스크(표시광고법·계약 분쟁)이므로 MEDICAL_LAW_TYPES에
// 합치지 않고 별도 사전으로 분리한다(기존 콘텐츠 검수 결과 오염 방지).
// 제안서·계약서·리포트 본문에서 "상위노출/AI노출/문의증가 보장" 오인 문구를 감지한다.

export const GUARANTEE_CLAIM_TYPES: MedicalLawType[] = [
  {
    code: 0,
    key: "rank_guarantee",
    label: "상위노출·순위 보장",
    severity: "high",
    patterns: [
      T("상위\\s*노출\\s*보장"),
      T("1\\s*페이지\\s*보장"),
      T("상단\\s*(노출|고정)\\s*보장"),
      T("순위\\s*보장"),
      // "상위노출 보장"·"AI 노출 보장"과의 중복 집계 방지(lookbehind)
      T("(?<!상위\\s{0,3})(?<!AI\\s{0,3})노출\\s*보장"),
      T("무조건\\s*상위")
    ]
  },
  {
    code: 0,
    key: "ai_guarantee",
    label: "AI 답변 노출 보장",
    severity: "high",
    patterns: [
      T("AI\\s*(답변|검색|추천)?\\s*노출\\s*(을|이)?\\s*보장"),
      T("AI\\s*답변\\s*(출현|인용)\\s*(을|이)?\\s*보장"),
      T("챗\\s*GPT[\\s가-힣]{0,6}보장"),
      T("AI\\s*추천\\s*보장")
    ]
  },
  {
    code: 0,
    key: "outcome_guarantee",
    label: "문의·매출 증가 보장",
    severity: "high",
    patterns: [
      T("문의\\s*(수|량)?\\s*(증가|상승)\\s*보장"),
      T("환자\\s*(수)?\\s*증가\\s*보장"),
      T("매출\\s*(증가|상승)?\\s*보장"),
      T("방문자\\s*(수)?\\s*(증가)?\\s*보장"),
      T("효과\\s*(를)?\\s*보장"),
      T("성과\\s*(를)?\\s*보장"),
      // '보장' 단어 없는 성과 단정(업무매뉴얼 05 검수 기준)
      T("(문의|환자|매출|방문자)[\\s가-힣]{0,6}반드시\\s*(늘|증가|상승)"),
      T("확실(히|하게)\\s*(늘어|증가|상승)")
    ]
  }
];

/** 제안·계약·리포트 텍스트에서 성과 보장성 문구를 검사(의료법 검사와 별도). */
export function checkGuaranteeClaims(text: string): ComplianceResult {
  const flags: ComplianceFlag[] = [];
  const seen = new Set<string>();
  for (const type of GUARANTEE_CLAIM_TYPES) {
    for (const re of type.patterns) {
      for (const m of text.matchAll(re)) {
        const dedupe = `${type.key}:${m[0]}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        flags.push({ type: type.key, label: type.label, code: type.code, severity: type.severity, matched: m[0] });
      }
    }
  }
  return {
    flags,
    highCount: flags.filter((f) => f.severity === "high").length,
    mediumCount: flags.filter((f) => f.severity === "medium").length
  };
}

/** 제안서·계약서·리포트에 자동 삽입하는 미보장 고지(기획서 §9). */
export const NON_GUARANTEE_DISCLAIMER =
  "[성과 미보장 고지] 검색 상위노출, AI 답변 노출, 문의·매출 증가는 검색엔진 및 AI 서비스의 정책·알고리즘에 따라 변동되며, " +
  "본 계약은 특정 순위·노출·성과를 보장하지 않습니다. 모든 지표는 모니터링·개선 활동의 참고 자료로 제공됩니다.";
