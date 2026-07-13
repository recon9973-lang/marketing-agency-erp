// src/domain/content/naver-schedule.ts
//
// 네이버 6단계 ⑥ — 주간 발행 스케줄 생성기(naver_channel_strategy 주간 발행표 반영).
// 요일별로 키워드 등급×콘텐츠 유형×목표 글자수×발행 시간 슬롯을 정의하고,
// 등급별 키워드를 슬롯에 배정해 한 주 발행 계획을 만든다(순수함수 — DB 무관, 테스트 용이).
// 실제 원고는 이 계획을 근거로 ContentPlan으로 승격되며 의료법 게이트를 그대로 통과한다.

import type { KeywordGrade } from "@/domain/marketing/keyword-grade";

export type WeeklySlot = {
  dow: number; // 0=일 ~ 6=토
  day: string;
  grade: KeywordGrade | null; // null=발행 없음(예: 일요일 예약설정)
  contentType: string;
  targetCharsMin: number;
  targetCharsMax: number;
  publishTime: string; // HH:mm (KST 권장)
  point: string;
};

// 근거: naver_channel_strategy "주간 발행 전략 & 시간표".
export const NAVER_WEEKLY_TEMPLATE: WeeklySlot[] = [
  { dow: 1, day: "월", grade: "A", contentType: "핵심 서비스 정보글", targetCharsMin: 2500, targetCharsMax: 3000, publishTime: "07:30", point: "주초 높은 트래픽 공략" },
  { dow: 2, day: "화", grade: "B", contentType: "비교/선택 가이드", targetCharsMin: 2000, targetCharsMax: 2500, publishTime: "07:30", point: "결정 단계 유저 타겟" },
  { dow: 3, day: "수", grade: "B", contentType: "질문형 롱테일", targetCharsMin: 1500, targetCharsMax: 2000, publishTime: "19:30", point: "지식iN 연계 키워드" },
  { dow: 4, day: "목", grade: "A", contentType: "정보 심화/사례", targetCharsMin: 2500, targetCharsMax: 3000, publishTime: "07:30", point: "신뢰도 핵심 콘텐츠(의료광고 준수)" },
  { dow: 5, day: "금", grade: "C", contentType: "생활정보/시즌", targetCharsMin: 1200, targetCharsMax: 1500, publishTime: "19:30", point: "주말 전 관심 환기" },
  { dow: 6, day: "토", grade: "C", contentType: "시즌/트렌드", targetCharsMin: 1500, targetCharsMax: 2000, publishTime: "10:00", point: "여가 시간 독서층" },
  { dow: 0, day: "일", grade: null, contentType: "다음주 예약발행 설정", targetCharsMin: 0, targetCharsMax: 0, publishTime: "", point: "사전 준비" }
];

export type PlannedItem = {
  date: string; // YYYY-MM-DD
  slot: WeeklySlot;
  keyword: string | null; // 배정된 키워드(없으면 null)
};

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * 주간 발행 계획 생성. weekStart(월요일 권장)부터 7일간, 각 요일 슬롯에
 * 해당 등급 키워드를 우선순위대로 하나씩 배정한다(중복 없이 소진).
 */
export function buildWeeklyPlan(
  keywordsByGrade: Record<KeywordGrade, string[]>,
  weekStart: Date
): PlannedItem[] {
  // 등급별 큐 복제(원본 불변).
  const queues: Record<KeywordGrade, string[]> = {
    A: [...(keywordsByGrade.A ?? [])],
    B: [...(keywordsByGrade.B ?? [])],
    C: [...(keywordsByGrade.C ?? [])]
  };
  const base = new Date(Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate()));
  const out: PlannedItem[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(base.getTime() + i * 86400000);
    const dow = date.getUTCDay();
    const slot = NAVER_WEEKLY_TEMPLATE.find((s) => s.dow === dow)!;
    const keyword = slot.grade ? queues[slot.grade].shift() ?? null : null;
    out.push({ date: ymd(date), slot, keyword });
  }
  return out;
}
