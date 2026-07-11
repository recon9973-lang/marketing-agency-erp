// 목표 경로: src/domain/sales/geo-channels.ts
//
// AI 채널 전략 플레이북 — "AI 노출 채널 전략 보고서"(채널×엔진 인용 가능성 매트릭스)와
// "GEO 실무 실행 가이드 + AI 자동화"(자동화 레벨 A~D) 문서를 도메인 데이터로 옮긴 것.
// 자동화 레벨: A=완전 자동화, B=반자동(사람 최종 검토), C=AI 보조(초안만), D=인간 필수.
// 병원 마케팅 맥락의 적합도(hospitalFit)를 함께 표기해 실무 우선순위를 돕는다.

import { WorkCategory } from "@/domain/types";
import type { OnboardingTaskTemplate } from "@/domain/sales/onboarding-tasks";

export type AutomationLevel = "A" | "B" | "C" | "D";

export const automationLevelLabels: Record<AutomationLevel, string> = {
  A: "완전 자동화",
  B: "반자동화",
  C: "AI 보조(초안)",
  D: "인간 필수"
};

export type GeoChannel = {
  channel: string;
  // 채널×엔진 인용 가능성(전략 보고서 §6.1) — 별 1~5
  ratings: { chatgpt: number; gemini: number; claude: number; perplexity: number };
  priority: string; // 통합 우선순위 (A+/A/B+…)
  automationLevel: AutomationLevel;
  hospitalFit: "높음" | "중간" | "낮음";
  note: string;
};

export const GEO_CHANNEL_PLAYBOOK: GeoChannel[] = [
  {
    channel: "대형 언론·보도자료",
    ratings: { chatgpt: 5, gemini: 5, claude: 3, perplexity: 4 },
    priority: "A+",
    automationLevel: "B",
    hospitalFit: "높음",
    note: "언드 미디어는 자사 콘텐츠 대비 인용률 325%↑ — 초안은 AI, 원장 인용문·배포는 사람"
  },
  {
    channel: "FAQ/Article Schema + BLUF 구조",
    ratings: { chatgpt: 4, gemini: 4, claude: 4, perplexity: 4 },
    priority: "A+",
    automationLevel: "A",
    hospitalFit: "높음",
    note: "기술 비용 대비 인용률 2~3배 — 답을 첫 문단에 배치(BLUF), 구조화 데이터 자동 삽입"
  },
  {
    channel: "YouTube (진료 설명 영상)",
    ratings: { chatgpt: 2, gemini: 4, claude: 2, perplexity: 4 },
    priority: "A",
    automationLevel: "B",
    hospitalFit: "높음",
    note: "Gemini·Perplexity 커버 — 자막(SRT) 자동 생성, 제목/설명 SEO는 반자동"
  },
  {
    channel: "커뮤니티 Q&A (지식iN·카페·Reddit)",
    ratings: { chatgpt: 4, gemini: 2, claude: 3, perplexity: 5 },
    priority: "A+",
    automationLevel: "C",
    hospitalFit: "중간",
    note: "봇 탐지·커뮤니티 신뢰 이슈 — AI는 초안만, 게시·소통은 반드시 사람(의료광고 검수 필수)"
  },
  {
    channel: "Wikipedia/위키 문서",
    ratings: { chatgpt: 5, gemini: 3, claude: 4, perplexity: 1 },
    priority: "A+",
    automationLevel: "C",
    hospitalFit: "낮음",
    note: "ChatGPT 인용 12.1% 독점 채널이나 병원 단독 항목은 등재 기준 충족이 어려움 — 의료 정보 기여 관점 접근"
  },
  {
    channel: "LinkedIn/전문가 아티클",
    ratings: { chatgpt: 3, gemini: 3, claude: 2, perplexity: 3 },
    priority: "B+",
    automationLevel: "B",
    hospitalFit: "중간",
    note: "의료진 개인 브랜딩(E-E-A-T 신호) — 작성·예약 게시 반자동, 톤 검토는 사람"
  },
  {
    channel: "학술 자료·백서",
    ratings: { chatgpt: 4, gemini: 4, claude: 5, perplexity: 3 },
    priority: "A",
    automationLevel: "C",
    hospitalFit: "중간",
    note: "Claude 인용 최상 — 진료 데이터 리포트·건강 백서 발행(의료법 검수 필수)"
  },
  {
    channel: "llms.txt·색인 인프라",
    ratings: { chatgpt: 3, gemini: 3, claude: 3, perplexity: 4 },
    priority: "A",
    automationLevel: "A",
    hospitalFit: "높음",
    note: "AI 크롤러 안내 파일 + 색인 요청 자동화 — 스크립트/워크플로우로 완전 자동화 가능"
  }
];

/**
 * "AI 채널 구축 패키지" 상품의 기본 업무 템플릿 — 계약 시 자동 생성.
 * 제목의 [자동화 X]는 위 레벨 기준(실행 시 도구·사람 개입 배분의 기준선).
 */
export const AI_CHANNEL_TASKS: OnboardingTaskTemplate[] = [
  {
    title: "[자동화 A] FAQPage/Article Schema 적용 + BLUF(답변 선두 배치) 구조 점검",
    category: WorkCategory.BLOG_SEO,
    offsetDays: 7,
    offsetFrom: "START",
    checklist: ["FAQ Schema", "Article Schema", "핵심 답변 첫 문단 배치", "구조 검증"]
  },
  {
    title: "[자동화 A] llms.txt 생성·업데이트 + 색인 요청 루틴 세팅",
    category: WorkCategory.BLOG_SEO,
    offsetDays: 10,
    offsetFrom: "START",
    checklist: ["llms.txt 생성", "사이트맵 갱신", "색인 요청 자동화 설정"]
  },
  {
    title: "[자동화 B] 언론 보도자료 1건 (AI 초안 → 원장 인용문·배포는 사람)",
    category: WorkCategory.BRAND_BLOG,
    offsetDays: 21,
    offsetFrom: "START",
    checklist: ["보도자료 초안", "의료광고 검수", "원장 인용문", "배포처 선정"]
  },
  {
    title: "[자동화 B] YouTube 진료 설명 영상 1건 + 자막(SRT)·제목/설명 SEO",
    category: WorkCategory.SNS_MANAGEMENT,
    offsetDays: 30,
    offsetFrom: "START",
    checklist: ["대본(의료광고 검수)", "촬영/편집", "자막 자동 생성", "제목·설명 최적화"]
  },
  {
    title: "[자동화 B] 의료진 전문가 아티클 게시 (LinkedIn/블로그 — E-E-A-T 신호)",
    category: WorkCategory.BRAND_BLOG,
    offsetDays: 30,
    offsetFrom: "START"
  },
  {
    title: "[자동화 C] 커뮤니티 Q&A 참여 — AI 초안만, 게시·소통은 사람 (지식iN·카페)",
    category: WorkCategory.SNS_MANAGEMENT,
    offsetDays: 30,
    offsetFrom: "START",
    checklist: ["질문 모니터링", "답변 초안(의료광고 검수)", "직접 게시", "이력 기록"]
  },
  {
    title: "[자동화 B] AI 인용 모니터링 루틴 — 승인 질문 20개 월 1회 실행·기록·캡처",
    category: WorkCategory.PERFORMANCE_COLLECTION,
    offsetDays: 30,
    offsetFrom: "START",
    checklist: ["엔진별 실행", "출현/인용 기록", "캡처 증빙", "경쟁사 언급 기록"]
  },
  {
    title: "[자동화 B] 분기 콘텐츠 전면 업데이트 계획 (Perplexity 최신성 70% 가중 대응)",
    category: WorkCategory.BRAND_BLOG,
    offsetDays: 80,
    offsetFrom: "START"
  }
];
