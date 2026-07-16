// 목표 경로: src/domain/sales/onboarding-tasks.ts
//
// 계약 체결 시 자동 생성하는 표준 온보딩 업무(기획서 §11 병원 1계정 표준 Task).
// Product.defaultTasks(Json)에 이 형식으로 저장하면 signContract가 읽어 WorkItem을 벌크 생성한다.
// offsetFrom: START = 계약 시작일 기준, END = 계약 종료일 기준(재계약 D-30, 권한 회수 등).

import { WorkCategory } from "@/domain/types";

export type OnboardingTaskTemplate = {
  title: string;
  category: WorkCategory;
  offsetDays: number;
  offsetFrom: "START" | "END";
  checklist?: string[];
  // GEO 채널 업무의 자동화 상한(cap). geo-channels 의 채널 automationLevel 로 clamp 되어,
  // 위키/커뮤니티 등 고위험 채널은 A/B(자동 실행)로 승격 불가. 인라인 리터럴(순환 import 방지).
  automationLevel?: "A" | "B" | "C" | "D";
  channel?: string; // GEO_CHANNEL_PLAYBOOK.channel 연결키(cap 조회용)
};

export const STANDARD_ONBOARDING_TASKS: OnboardingTaskTemplate[] = [
  {
    title: "계약서·견적서·미보장 문구 확인",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 0,
    offsetFrom: "START"
  },
  {
    title: "자료 요청 폼 발송 (병원명·진료과·의료진·장비·진료시간·주소·전화·주차/교통·상담 가능 시간·대표 시술)",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 1,
    offsetFrom: "START"
  },
  {
    title: "권한 요청 발송",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 2,
    offsetFrom: "START",
    checklist: ["GSC", "GA4", "Google Business Profile", "네이버 서치어드바이저", "네이버 플레이스", "CMS", "도메인/DNS"]
  },
  {
    title: "금지·주의 표현 안내문 전달 + 병원 승인 담당자 1인 지정",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 3,
    offsetFrom: "START",
    checklist: ["의료광고 금지 표현 안내문 발송", "병원 측 승인 담당자 지정 확인", "승인 채널(포털) 안내"]
  },
  {
    title: "초기 SEO 진단",
    category: WorkCategory.BLOG_SEO,
    offsetDays: 7,
    offsetFrom: "START",
    checklist: ["색인", "메타", "사이트맵", "robots", "모바일", "진료과 구조", "CTA", "프로필"]
  },
  {
    title: "SEO 기본 적용 (title/description·내부링크·진료과 랜딩·FAQ·전환 버튼)",
    category: WorkCategory.BLOG_SEO,
    offsetDays: 14,
    offsetFrom: "START"
  },
  {
    title: "GEO 질문 20개 (후보 생성·병원 승인·페이지 매핑·모니터링 기준)",
    category: WorkCategory.BLOG_SEO,
    offsetDays: 21,
    offsetFrom: "START"
  },
  {
    title: "콘텐츠 운영 시작 (월 콘텐츠 캘린더·초안·검수·승인·게시)",
    category: WorkCategory.BRAND_BLOG,
    offsetDays: 21,
    offsetFrom: "START"
  },
  {
    title: "월간 리포트 (데이터 수집·초안·PM 코멘트·원장 브리핑)",
    category: WorkCategory.MONTHLY_REPORT,
    offsetDays: 30,
    offsetFrom: "START"
  },
  {
    title: "재계약 제안 (성과 요약·업셀 후보·견적 발송)",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: -30,
    offsetFrom: "END"
  },
  {
    title: "계약종료 권한 회수 (GSC·GA4·GBP·네이버·CMS 접근 권한 해제)",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 0,
    offsetFrom: "END"
  }
];

/** END 앵커인데 종료일이 없으면 시작일+365일을 대체 앵커로 사용(업무 누락 방지). */
export function resolveTaskDueDate(
  template: Pick<OnboardingTaskTemplate, "offsetDays" | "offsetFrom">,
  startDate: Date,
  endDate: Date | null
): Date {
  const anchor =
    template.offsetFrom === "END"
      ? endDate ?? new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000)
      : startDate;
  return new Date(anchor.getTime() + template.offsetDays * 24 * 60 * 60 * 1000);
}
