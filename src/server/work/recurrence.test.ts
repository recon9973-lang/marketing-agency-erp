// src/server/work/recurrence.test.ts
import { describe, it, expect } from "vitest";
import { dueWorkRecurrences, type RecurrenceSeries } from "./recurrence";
import { WorkCategory } from "@/domain/types";

const NOW = new Date("2026-07-16T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function series(over: Partial<RecurrenceSeries> = {}): RecurrenceSeries {
  return {
    clientId: "c1",
    templateId: "t1",
    ownerId: "u1",
    title: "월간 리포트",
    category: WorkCategory.MONTHLY_REPORT,
    priority: 3,
    cadenceDays: 30,
    lastCreatedAt: new Date(NOW.getTime() - 30 * DAY),
    ...over
  };
}

describe("반복 업무 자동 생성 — dueWorkRecurrences", () => {
  it("주기가 도래하면(경과일 ≥ cadenceDays) 새 업무를 생성한다", () => {
    const out = dueWorkRecurrences([series({ lastCreatedAt: new Date(NOW.getTime() - 31 * DAY) })], NOW);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ clientId: "c1", templateId: "t1", ownerId: "u1", title: "월간 리포트", priority: 3 });
  });

  it("경과일이 정확히 cadenceDays면 생성한다(경계 포함)", () => {
    const out = dueWorkRecurrences([series({ lastCreatedAt: new Date(NOW.getTime() - 30 * DAY) })], NOW);
    expect(out).toHaveLength(1);
  });

  it("주기 미도래(경과일 < cadenceDays)면 생성하지 않는다", () => {
    const out = dueWorkRecurrences([series({ lastCreatedAt: new Date(NOW.getTime() - 29 * DAY) })], NOW);
    expect(out).toHaveLength(0);
  });

  it("dueDate는 now + cadenceDays로 잡힌다", () => {
    const out = dueWorkRecurrences([series()], NOW);
    expect(out[0].dueDate.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("cadenceDays가 없거나 0 이하면 건너뛴다", () => {
    expect(dueWorkRecurrences([series({ cadenceDays: null })], NOW)).toHaveLength(0);
    expect(dueWorkRecurrences([series({ cadenceDays: 0 })], NOW)).toHaveLength(0);
    expect(dueWorkRecurrences([series({ cadenceDays: -5 })], NOW)).toHaveLength(0);
  });

  it("같은 (거래처×템플릿)은 실행당 1건만 방출한다(중복 앵커 방어)", () => {
    const dup = [
      series({ lastCreatedAt: new Date(NOW.getTime() - 40 * DAY) }),
      series({ lastCreatedAt: new Date(NOW.getTime() - 35 * DAY) })
    ];
    expect(dueWorkRecurrences(dup, NOW)).toHaveLength(1);
  });

  it("여러 주기가 밀려 있어도 소급 백필하지 않고 1건만 만든다", () => {
    const out = dueWorkRecurrences([series({ cadenceDays: 7, lastCreatedAt: new Date(NOW.getTime() - 90 * DAY) })], NOW);
    expect(out).toHaveLength(1);
  });

  it("서로 다른 거래처·템플릿은 각각 생성한다", () => {
    const out = dueWorkRecurrences(
      [series({ clientId: "c1", templateId: "t1" }), series({ clientId: "c2", templateId: "t1" }), series({ clientId: "c1", templateId: "t2" })],
      NOW
    );
    expect(out).toHaveLength(3);
  });
});
