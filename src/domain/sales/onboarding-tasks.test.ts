// src/domain/sales/onboarding-tasks.test.ts
import { describe, it, expect } from "vitest";
import {
  STANDARD_ONBOARDING_TASKS,
  WEEKLY_ROUTINE_TASKS,
  onboardingPhaseSummary,
  totalChecklistItems,
  resolveTaskDueDate,
  type OnboardingPhase
} from "./onboarding-tasks";

describe("온보딩 Phase 체크리스트(매뉴얼 §4 반영)", () => {
  it("모든 표준 온보딩 태스크에 phase와 checklist가 채워져 있다", () => {
    for (const t of STANDARD_ONBOARDING_TASKS) {
      expect(t.phase, `phase 누락: ${t.title}`).toBeDefined();
      expect((t.checklist?.length ?? 0), `checklist 비어있음: ${t.title}`).toBeGreaterThan(0);
    }
  });

  it("Phase 집계는 설계 순서(설정→콘텐츠→GEO→라이프사이클)를 따른다", () => {
    const summary = onboardingPhaseSummary();
    const phases = summary.map((s) => s.phase);
    // 존재하는 Phase만 순서대로 나온다
    const expectedOrder: OnboardingPhase[] = ["PHASE1_SETUP", "PHASE2_CONTENT", "PHASE3_GEO", "LIFECYCLE"];
    expect(phases).toEqual(expectedOrder.filter((p) => phases.includes(p)));
    // 각 Phase는 태스크 1개 이상·체크리스트 항목 1개 이상
    for (const s of summary) {
      expect(s.tasks).toBeGreaterThan(0);
      expect(s.checklistItems).toBeGreaterThan(0);
      expect(s.label).toBeTruthy();
    }
  });

  it("집계 태스크 수는 원본 태스크 수와 일치한다(누락 없음)", () => {
    const summary = onboardingPhaseSummary();
    const counted = summary.reduce((sum, s) => sum + s.tasks, 0);
    expect(counted).toBe(STANDARD_ONBOARDING_TASKS.length);
  });

  it("주간 루틴은 월~금 5일 + 각 체크리스트를 갖는다", () => {
    expect(WEEKLY_ROUTINE_TASKS).toHaveLength(5);
    expect(WEEKLY_ROUTINE_TASKS.map((t) => t.day)).toEqual(["월", "화", "수", "목", "금"]);
    for (const t of WEEKLY_ROUTINE_TASKS) expect(t.checklist.length).toBeGreaterThan(0);
  });

  it("총 체크리스트 항목 수 = 온보딩 + 주간(집계 일관성)", () => {
    const onboarding = STANDARD_ONBOARDING_TASKS.reduce((s, t) => s + (t.checklist?.length ?? 0), 0);
    const weekly = WEEKLY_ROUTINE_TASKS.reduce((s, t) => s + t.checklist.length, 0);
    expect(totalChecklistItems()).toBe(onboarding + weekly);
    expect(totalChecklistItems()).toBeGreaterThanOrEqual(40); // 매뉴얼 Phase 규모(≈46) 반영
  });

  it("빈 배열을 넘기면 빈 집계를 반환한다(경계)", () => {
    expect(onboardingPhaseSummary([])).toEqual([]);
  });

  it("resolveTaskDueDate: END 앵커인데 종료일이 없으면 시작+365일을 대체 앵커로 쓴다", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const due = resolveTaskDueDate({ offsetDays: 0, offsetFrom: "END" }, start, null);
    expect(due.getTime()).toBe(start.getTime() + 365 * 24 * 60 * 60 * 1000);
  });
});
