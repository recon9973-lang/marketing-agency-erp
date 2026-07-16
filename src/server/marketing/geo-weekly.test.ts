// src/server/marketing/geo-weekly.test.ts
import { describe, it, expect } from "vitest";
import { buildGeoWeekly } from "./geo-weekly";

describe("거래처 GEO 주간 리포트 — 규칙 기반 집계", () => {
  it("출현·인용·SOV우위·업무완료를 성과로, 악화를 리스크로 분류", () => {
    const r = buildGeoWeekly({
      clientName: "시원통증",
      region: "포항",
      weekLabel: "2026-W29",
      exposure: { monitored: 20, appeared: 6, cited: 2 },
      sovPct: 62,
      metrics: [
        { name: "clicks", latest: 150, prev: 120 },
        { name: "position", latest: 7.4, prev: 8.2, betterWhenLower: true },
        { name: "impressions", latest: 3000, prev: 3200 }
      ],
      work: { total: 6, done: 3, approvalPending: 1, failed: 1 }
    });
    expect(r.keyWins).toContain("AI 답변 출현 질문 6/20");
    expect(r.keyWins).toContain("공식 URL 인용 질문 2");
    expect(r.keyWins).toContain("경쟁사 대비 SOV 62% (우위)");
    expect(r.keyWins.some((w) => w.startsWith("clicks 개선"))).toBe(true);
    expect(r.keyWins.some((w) => w.startsWith("position 개선"))).toBe(true); // 순위 하락=개선
    expect(r.risks.some((w) => w.startsWith("impressions 악화"))).toBe(true);
    expect(r.keyWins).toContain("업무 완료율 50% (3/6)");
    expect(r.nextActions).toContain("승인 대기 업무 1건 처리");
    expect(r.risks).toContain("중단(BLOCKED) 업무 1건 — 재작업/해제");
    expect(r.summary).toContain("시원통증");
    expect(r.summary).toContain("SOV 62%");
  });

  it("SOV 열세는 리스크 + 다음액션", () => {
    const r = buildGeoWeekly({
      clientName: "A", weekLabel: "W1",
      exposure: { monitored: 10, appeared: 1, cited: 0 },
      sovPct: 30,
      work: { total: 0, done: 0, approvalPending: 0, failed: 0 }
    });
    expect(r.risks).toContain("경쟁사 대비 SOV 30% (열세)");
    expect(r.nextActions).toContain("경쟁사 우위 채널 분석 → 해당 채널 콘텐츠 강화");
    expect(r.nextActions).toContain("이번 주 배정 업무 없음 — 채널 플레이북에서 생성");
  });

  it("실측·업무 없음도 안전(다음액션 안내)", () => {
    const r = buildGeoWeekly({
      clientName: "B", weekLabel: "W1", exposure: null,
      work: { total: 0, done: 0, approvalPending: 0, failed: 0 }
    });
    expect(r.nextActions).toContain("AI 인용 실측 미실행 — 승인 질문 관측 실행");
    expect(r.risks).toEqual([]);
    expect(r.summary).toContain("AI 실측 없음");
  });

  it("출현 0은 리스크로 잡는다", () => {
    const r = buildGeoWeekly({
      clientName: "C", weekLabel: "W1",
      exposure: { monitored: 12, appeared: 0, cited: 0 },
      work: { total: 4, done: 4, approvalPending: 0, failed: 0 }
    });
    expect(r.risks).toContain("이번 주 AI 답변 출현 질문 0 — 콘텐츠·질문 설계 점검");
    expect(r.keyWins).toContain("업무 완료율 100% (4/4)");
  });
});
