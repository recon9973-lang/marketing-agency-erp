// src/components/clients/ClientOnboardingProgress.test.ts
import { describe, it, expect } from "vitest";
import { buildOnboardingProgress } from "./ClientOnboardingProgress";
import { STANDARD_ONBOARDING_TASKS } from "@/domain/sales/onboarding-tasks";

describe("buildOnboardingProgress(works → Phase 진행률)", () => {
  it("업무가 없으면 모든 Phase가 0%·tracked=false로 나온다", () => {
    const phases = buildOnboardingProgress([]);
    expect(phases.map((p) => p.phase)).toEqual(["PHASE1_SETUP", "PHASE2_CONTENT", "PHASE3_GEO", "LIFECYCLE"]);
    for (const p of phases) {
      expect(p.completed).toBe(0);
      expect(p.pct).toBe(0);
      expect(p.tasks.every((t) => !t.tracked && !t.done)).toBe(true);
    }
  });

  it("Phase별 태스크 수 합계는 표준 온보딩 태스크 수와 일치한다", () => {
    const phases = buildOnboardingProgress([]);
    expect(phases.reduce((s, p) => s + p.total, 0)).toBe(STANDARD_ONBOARDING_TASKS.length);
  });

  it("표준 태스크 제목과 매칭되는 COMPLETED 업무는 해당 Phase 완료로 집계된다", () => {
    const p1 = STANDARD_ONBOARDING_TASKS.find((t) => (t.phase ?? "LIFECYCLE") === "PHASE1_SETUP")!;
    const phases = buildOnboardingProgress([{ title: p1.title, status: "COMPLETED" }]);
    const setup = phases.find((p) => p.phase === "PHASE1_SETUP")!;
    expect(setup.completed).toBe(1);
    expect(setup.pct).toBe(Math.round((1 / setup.total) * 100));
    expect(setup.tasks.find((t) => t.title === p1.title)!.done).toBe(true);
  });

  it("미완료 상태(IN_PROGRESS 등)는 tracked=true·done=false로 구분한다", () => {
    const p1 = STANDARD_ONBOARDING_TASKS[0];
    const phases = buildOnboardingProgress([{ title: p1.title, status: "IN_PROGRESS" }]);
    const task = phases.flatMap((p) => p.tasks).find((t) => t.title === p1.title)!;
    expect(task.tracked).toBe(true);
    expect(task.done).toBe(false);
  });

  it("표준 태스크와 무관한 업무는 진행률에 영향을 주지 않는다", () => {
    const phases = buildOnboardingProgress([{ title: "임의의 비표준 업무", status: "COMPLETED" }]);
    expect(phases.reduce((s, p) => s + p.completed, 0)).toBe(0);
  });

  it("같은 제목 업무가 여럿이고 하나라도 COMPLETED면 1건 완료로 센다", () => {
    const t = STANDARD_ONBOARDING_TASKS[0];
    const phases = buildOnboardingProgress([
      { title: t.title, status: "IN_PROGRESS" },
      { title: t.title, status: "COMPLETED" }
    ]);
    const slot = phases.find((p) => (p.tasks.some((x) => x.title === t.title)))!;
    expect(slot.tasks.find((x) => x.title === t.title)!.done).toBe(true);
  });
});
