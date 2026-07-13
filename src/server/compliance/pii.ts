// src/server/compliance/pii.ts
//
// 개인정보(PII) 마스킹 — AI 입력 전 환자 식별정보를 가린다(기획서 §9 AI사용: 환자 식별정보 입력 금지·익명화).
// 대상: 주민등록번호, 전화번호, 이메일, 카드번호. 사람 이름은 문맥 의존이라 규칙기반에서 제외(오탐 위험).
// 원칙: 마스킹은 되돌릴 수 없게(원문 미보존). AI에 넘기는 텍스트에만 적용.

export type PiiKind = "rrn" | "phone" | "email" | "card";

type PiiRule = { kind: PiiKind; re: RegExp; mask: string };

// 순서 주의: 카드/주민번호를 전화보다 먼저 처리(더 구체적인 패턴 우선).
const RULES: PiiRule[] = [
  // 주민등록번호 6-7 (하이픈/공백 허용)
  { kind: "rrn", re: /\b\d{6}\s*[-]\s*\d{7}\b/g, mask: "[주민번호]" },
  // 카드번호 4-4-4-4 (하이픈/공백 구분)
  { kind: "card", re: /\b\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\b/g, mask: "[카드번호]" },
  // 이메일
  { kind: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, mask: "[이메일]" },
  // 전화번호(국내 휴대폰/유선: 02/0xx-xxx(x)-xxxx, +82 허용)
  { kind: "phone", re: /(\+?82[- ]?|0)\d{1,2}[- ]?\d{3,4}[- ]?\d{4}\b/g, mask: "[전화번호]" }
];

export type PiiResult = { text: string; found: Record<PiiKind, number>; total: number };

/** 텍스트에서 PII를 마스킹하고 종류별 개수를 반환한다. */
export function redactPII(input: string): PiiResult {
  const found: Record<PiiKind, number> = { rrn: 0, phone: 0, email: 0, card: 0 };
  let text = input ?? "";
  for (const rule of RULES) {
    text = text.replace(rule.re, () => {
      found[rule.kind]++;
      return rule.mask;
    });
  }
  const total = found.rrn + found.phone + found.email + found.card;
  return { text, found, total };
}

/** PII 포함 여부만 빠르게 확인. */
export function hasPII(input: string): boolean {
  return redactPII(input).total > 0;
}
