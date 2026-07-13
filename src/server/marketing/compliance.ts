// src/server/marketing/compliance.ts
//
// S3 · 의료광고법 컴플라이언스 검수 게이트.
// 근거: seo-writing-skill/references/medical-compliance.md (의료법 제56·57조 요약).
// 병원 콘텐츠는 발행 전 이 검사를 통과해야 한다. BLOCK이면 발행 차단.
// 순수 규칙기반(외부 의존 없음) → 테스트 가능하고 배치에서도 안전.
//
// 주의: 이 검사는 1차 자동 게이트다. 심화 검수(seo-medical-expert)나 사람 리뷰를 대체하지 않는다.
// 애매하면 안전한 쪽(WARN 이상)으로 판정한다.

import type { ComplianceVerdict } from "@/domain/marketing/schemas";

export type ComplianceSeverity = "BLOCK" | "WARN";

export type ComplianceFinding = {
  severity: ComplianceSeverity;
  rule: string;
  match: string;
  message: string;
};

export type ComplianceReport = {
  verdict: ComplianceVerdict; // PASS | WARN | BLOCK
  findings: ComplianceFinding[];
  checkedAt: string;
};

type Rule = { rule: string; severity: ComplianceSeverity; re: RegExp; message: string };

// 금지(BLOCK): 명백한 허위·과장. 존재하면 발행 차단.
// 주의(WARN): 맥락에 따라 문제. 사람 검토 필요.
const RULES: Rule[] = [
  {
    rule: "치료효과 보장·단정",
    severity: "BLOCK",
    re: /(100\s*%|100\s*퍼센트)\s*(완치|치료|효과)|완치\s*보장|반드시\s*(낫|치료|완치|효과)|부작용\s*(이|은|도)?\s*(전혀\s*)?없(다|음|습니다|어요)|무조건\s*(완치|효과)|영구\s*(완치|보장)/g,
    message: "치료효과를 보장·단정하는 표현(의료법 제56조 금지)",
  },
  {
    rule: "최상급·유일성",
    severity: "BLOCK",
    re: /(최고|최상급|제일|유일한|유일무이|국내\s*1위|업계\s*1위|세계\s*1위|넘버원|No\.?\s*1)/gi,
    message: "객관적 근거·인증 없는 최상급·유일성 표현",
  },
  {
    rule: "환자 유인",
    severity: "WARN",
    re: /(할인\s*이벤트|이벤트\s*할인|비급여\s*할인|특가|최저가|무료\s*시술|시술\s*무료|사은품|경품|선착순)/g,
    message: "비급여 할인·이벤트성 환자 유인 소지(의료법 제27조 확인 필요)",
  },
  {
    rule: "비교광고",
    severity: "WARN",
    re: /(타\s*병원|다른\s*병원|타\s*의원|타원)\s*(보다|대비|과\s*달리)/g,
    message: "다른 의료기관과의 비교 우위 표현",
  },
  {
    rule: "치료경험담·전후비교",
    severity: "BLOCK",
    re: /(치료|시술|수술)?\s*후기|체험담|경험담|전\s*후\s*(사진|비교)|비포\s*[-·]?\s*애프터|before\s*[-/&]?\s*after/gi,
    message: "치료경험담·전후 비교 사진(의료법 제56조 치료효과 오인 금지)",
  },
];

// 효과를 언급했는데 안전장치(부작용/주의/개인차/상담)가 전혀 없으면 WARN.
const EFFECT_RE = /(효과|개선|치료|완화|호전|교정)/;
const SAFEGUARD_RE = /(부작용|주의|개인\s*차|개인에\s*따라|상담|의료진|전문의|다를\s*수\s*있)/;

export function reviewMedicalCompliance(text: string): ComplianceReport {
  const findings: ComplianceFinding[] = [];
  const src = text ?? "";

  for (const r of RULES) {
    const matches = src.match(r.re);
    if (matches) {
      for (const m of Array.from(new Set(matches))) {
        findings.push({ severity: r.severity, rule: r.rule, match: m.trim(), message: r.message });
      }
    }
  }

  if (EFFECT_RE.test(src) && !SAFEGUARD_RE.test(src)) {
    findings.push({
      severity: "WARN",
      rule: "부작용·주의 병기 누락",
      match: "",
      message: "효과를 언급했으나 부작용·주의·개인차·상담 안내가 없음",
    });
  }

  const verdict: ComplianceVerdict = findings.some((f) => f.severity === "BLOCK")
    ? "BLOCK"
    : findings.length > 0
      ? "WARN"
      : "PASS";

  return { verdict, findings, checkedAt: new Date().toISOString() };
}
