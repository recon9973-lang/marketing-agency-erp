// 목표 경로: src/domain/sales/onboarding-tasks.ts
//
// 계약 체결 시 자동 생성하는 표준 온보딩 업무(기획서 §11 병원 1계정 표준 Task).
// Product.defaultTasks(Json)에 이 형식으로 저장하면 signContract가 읽어 WorkItem을 벌크 생성한다.
// offsetFrom: START = 계약 시작일 기준, END = 계약 종료일 기준(재계약 D-30, 권한 회수 등).
//
// Phase 체크리스트(통합 설계서 v2 §4) — 매뉴얼의 Phase 1/2/3 + 주간 루틴 구조를
// 별도 모델 없이 태스크 checklist[]로 반영한다(모델 변경 0). 근거(저장소 문서):
//   docs/plans/geo-ops-os-plan.md(7일 온보딩·주간 루프·자동화 등급 A~D)
//   docs/plans/geo-ops-pilot-runbook.md(권한·GSC/GA4·주간 운영)
//   docs/plans/geo-erp-integration-design-v2.md §4(Phase 매핑)

import { WorkCategory } from "@/domain/types";

// 매뉴얼 Phase 구분 — 온보딩 진행률/체크리스트를 Phase 단위로 집계하기 위한 태그.
export type OnboardingPhase = "PHASE1_SETUP" | "PHASE2_CONTENT" | "PHASE3_GEO" | "LIFECYCLE";

export const onboardingPhaseLabels: Record<OnboardingPhase, string> = {
  PHASE1_SETUP: "Phase 1 · 계정·기반 설정",
  PHASE2_CONTENT: "Phase 2 · 콘텐츠",
  PHASE3_GEO: "Phase 3 · GEO 확인",
  LIFECYCLE: "라이프사이클(갱신·종료)"
};

export type OnboardingTaskTemplate = {
  title: string;
  category: WorkCategory;
  offsetDays: number;
  offsetFrom: "START" | "END";
  checklist?: string[];
  phase?: OnboardingPhase;
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
    offsetFrom: "START",
    phase: "PHASE1_SETUP",
    checklist: ["계약서 서명본 확인", "견적서·과금 항목 대조", "순위·효과 미보장 문구 명시 확인", "의료광고 준수 범위 합의"]
  },
  {
    title: "자료 요청 폼 발송 (병원명·진료과·의료진·장비·진료시간·주소·전화·주차/교통·상담 가능 시간·대표 시술)",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 1,
    offsetFrom: "START",
    phase: "PHASE1_SETUP",
    checklist: ["자료 요청 폼 발송", "회신 기한 안내", "회신 자료 검토·부족분 재요청"]
  },
  {
    title: "권한 요청 발송",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 2,
    offsetFrom: "START",
    phase: "PHASE1_SETUP",
    checklist: ["GSC", "GA4", "Google Business Profile", "네이버 서치어드바이저", "네이버 플레이스", "CMS", "도메인/DNS"]
  },
  {
    title: "금지·주의 표현 안내문 전달 + 병원 승인 담당자 1인 지정",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 3,
    offsetFrom: "START",
    phase: "PHASE1_SETUP",
    checklist: ["의료광고 금지 표현 안내문 발송", "병원 측 승인 담당자 지정 확인", "승인 채널(포털) 안내"]
  },
  {
    title: "초기 SEO 진단",
    category: WorkCategory.BLOG_SEO,
    offsetDays: 7,
    offsetFrom: "START",
    phase: "PHASE1_SETUP",
    checklist: ["색인", "메타", "사이트맵", "robots", "모바일", "진료과 구조", "CTA", "프로필"]
  },
  {
    title: "SEO 기본 적용 (title/description·내부링크·진료과 랜딩·FAQ·전환 버튼)",
    category: WorkCategory.BLOG_SEO,
    offsetDays: 14,
    offsetFrom: "START",
    phase: "PHASE1_SETUP",
    checklist: ["title/description 최적화", "내부링크 구조", "진료과 랜딩 페이지", "FAQ 섹션", "전환 버튼(CTA)"]
  },
  {
    title: "GEO 질문 20개 (후보 생성·병원 승인·페이지 매핑·모니터링 기준)",
    category: WorkCategory.BLOG_SEO,
    offsetDays: 21,
    offsetFrom: "START",
    phase: "PHASE3_GEO",
    checklist: ["질문 후보 생성(엔진별)", "병원 승인 20개 확정", "질문→타깃 페이지 매핑", "모니터링 기준(주 1회) 설정", "llms.txt·Schema 대상 지정"]
  },
  {
    title: "콘텐츠 운영 시작 (월 콘텐츠 캘린더·초안·검수·승인·게시)",
    category: WorkCategory.BRAND_BLOG,
    offsetDays: 21,
    offsetFrom: "START",
    phase: "PHASE2_CONTENT",
    checklist: ["월 콘텐츠 캘린더(4주)", "초안 작성(B레벨 승인큐)", "의료광고 검수", "병원 승인", "발행·색인 요청"]
  },
  {
    title: "월간 리포트 (데이터 수집·초안·PM 코멘트·원장 브리핑)",
    category: WorkCategory.MONTHLY_REPORT,
    offsetDays: 30,
    offsetFrom: "START",
    phase: "PHASE3_GEO",
    checklist: ["데이터 수집(GSC/GA4/AI 인용)", "SOV·추세(delta) 산출", "PM 코멘트", "원장 브리핑", "다음 달 액션 3"]
  },
  {
    title: "재계약 제안 (성과 요약·업셀 후보·견적 발송)",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: -30,
    offsetFrom: "END",
    phase: "LIFECYCLE",
    checklist: ["성과 요약(SOV·추세)", "업셀 후보 도출", "견적 발송", "갱신 일정 협의"]
  },
  {
    title: "계약종료 권한 회수 (GSC·GA4·GBP·네이버·CMS 접근 권한 해제)",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    offsetDays: 0,
    offsetFrom: "END",
    phase: "LIFECYCLE",
    checklist: ["GSC 접근 해제", "GA4 접근 해제", "GBP 관리자 해제", "네이버 권한 해제", "CMS·도메인 접근 해제"]
  }
];

/**
 * 주간 운영 루틴(설계 §7·운영계획 월~금 루프) — 반복 업무 시드.
 * cadenceDays=7로 WorkTemplate에 등록하면 M4 반복 생성(runWorkRecurrence)이 매주 인스턴스화한다.
 * 온보딩(1회성)과 분리 — 여기에는 offset 앵커가 없다(주기 기반).
 */
export const WEEKLY_ROUTINE_TASKS: Array<{ day: "월" | "화" | "수" | "목" | "금"; title: string; category: WorkCategory; checklist: string[] }> = [
  {
    day: "월",
    title: "[주간] 이번 주 업무 자동 생성·배정 확인",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    checklist: ["반복 업무 생성 확인", "담당·마감 배정", "승인 대기 큐 점검"]
  },
  {
    day: "화",
    title: "[주간] 발행·색인 요청·llms.txt 갱신",
    category: WorkCategory.BLOG_SEO,
    checklist: ["콘텐츠 발행", "GSC 색인 요청", "llms.txt·sitemap 갱신"]
  },
  {
    day: "수",
    title: "[주간] 영상/이미지·구조화 데이터(Schema) 검증",
    category: WorkCategory.SNS_MANAGEMENT,
    checklist: ["영상/이미지 제작", "FAQ/Article Schema 검증", "BLUF 구조 점검"]
  },
  {
    day: "목",
    title: "[주간] 커뮤니티 기회 확인 (Wikipedia·Reddit은 인간 필수)",
    category: WorkCategory.SNS_MANAGEMENT,
    checklist: ["커뮤니티 질문 모니터링", "답변 초안(의료광고 검수)", "직접 게시(D 등급)"]
  },
  {
    day: "금",
    title: "[주간] 성과 수집·주간 리포트·다음 주 액션 3",
    category: WorkCategory.PERFORMANCE_COLLECTION,
    checklist: ["GSC/GA4·AI 인용 수집", "주간 리포트 확인", "다음 주 액션 3 도출"]
  }
];

export type OnboardingPhaseStat = { phase: OnboardingPhase; label: string; tasks: number; checklistItems: number };

/**
 * Phase별 태스크·체크리스트 항목 수 집계(진행률 UI·검증용, 순수 함수).
 * 매뉴얼의 "Phase 46항목" 구조를 코드에서 그대로 셀 수 있게 한다.
 */
export function onboardingPhaseSummary(tasks: OnboardingTaskTemplate[] = STANDARD_ONBOARDING_TASKS): OnboardingPhaseStat[] {
  const order: OnboardingPhase[] = ["PHASE1_SETUP", "PHASE2_CONTENT", "PHASE3_GEO", "LIFECYCLE"];
  const byPhase = new Map<OnboardingPhase, { tasks: number; checklistItems: number }>();
  for (const t of tasks) {
    const phase = t.phase ?? "LIFECYCLE";
    const slot = byPhase.get(phase) ?? { tasks: 0, checklistItems: 0 };
    slot.tasks++;
    slot.checklistItems += t.checklist?.length ?? 0;
    byPhase.set(phase, slot);
  }
  return order
    .filter((p) => byPhase.has(p))
    .map((p) => ({ phase: p, label: onboardingPhaseLabels[p], tasks: byPhase.get(p)!.tasks, checklistItems: byPhase.get(p)!.checklistItems }));
}

/** 온보딩+주간 체크리스트 항목 총계(매뉴얼 Phase 항목 반영 규모 확인용). */
export function totalChecklistItems(tasks: OnboardingTaskTemplate[] = STANDARD_ONBOARDING_TASKS): number {
  const onboarding = tasks.reduce((sum, t) => sum + (t.checklist?.length ?? 0), 0);
  const weekly = WEEKLY_ROUTINE_TASKS.reduce((sum, t) => sum + t.checklist.length, 0);
  return onboarding + weekly;
}

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
