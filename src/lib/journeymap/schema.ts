// F-952 스키마 자동 생성 (v2.1 §3.3) — FAQPage · MedicalClinic JSON-LD
// 의료법 게이트: 리스크 스캐너(🔴 금지)를 통과한 질문만 FAQ에 포함

import { scanRisk } from "./risk";
import { HospitalProfile, JNode } from "./types";

export interface FaqSchemaResult {
  jsonLd: string;
  included: number;
  excludedRed: number; // 의료법 금지 표현으로 제외된 질문 수
  hasYellow: boolean; // 주의 표현 포함 질문 존재 여부
}

const ANSWER_PLACEHOLDER =
  "여기에 의료진이 검수한 답변을 작성하세요. (의료법 유의: 치료효과 보장·비용 유인·비교 최상급 표현 금지, 부작용·개인차 고지 권장)";

// 지식iN 실측 질문 기반 FAQPage 스키마 (답변은 의료진 작성용 초안 틀 제공)
export function buildFaqSchema(nodes: JNode[], max = 8): FaqSchemaResult {
  const questions = nodes.filter((n) => n.kind === "keyword" && n.source === "naver_kin");
  let excludedRed = 0;
  let hasYellow = false;
  const picked: string[] = [];
  for (const q of questions) {
    if (picked.length >= max) break;
    const risk = scanRisk(q.keyword);
    if (risk.level === "red") {
      excludedRed++;
      continue;
    }
    if (risk.level === "yellow") hasYellow = true;
    picked.push(q.keyword.endsWith("?") ? q.keyword : `${q.keyword}?`);
  }
  const jsonLd = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: picked.map((q) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: ANSWER_PLACEHOLDER },
      })),
    },
    null,
    2
  );
  return { jsonLd, included: picked.length, excludedRed, hasYellow };
}

// 병원 프로필 기반 MedicalClinic(LocalBusiness) 스키마
export function buildClinicSchema(profile: HospitalProfile): string {
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "MedicalClinic",
      name: profile.name,
      medicalSpecialty: profile.departments,
      address: {
        "@type": "PostalAddress",
        addressCountry: "KR",
        addressLocality: [profile.regionSigungu, profile.regionDong].filter(Boolean).join(" "),
      },
      url: "https://병원-홈페이지-주소를-입력하세요",
      telephone: "병원-전화번호를-입력하세요",
    },
    null,
    2
  );
}
