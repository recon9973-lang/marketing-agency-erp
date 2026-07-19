import { describe, expect, it } from "vitest";
import {
  ACTIVE_CLIENT_STAGES,
  CLIENT_STAGES,
  canTransitionClientStage,
  clientStageLabels,
  clientStageProgress,
  computeStageSla,
  isClientStage,
  suggestNextStage,
  toClientStage,
  type StageSignals
} from "./client-stages";

describe("client-stages · 상태 정의", () => {
  it("모든 단계에 라벨이 있다", () => {
    for (const s of CLIENT_STAGES) expect(clientStageLabels[s]).toBeTruthy();
  });
  it("활성 단계는 5개(배정→운영), 중지·해지는 제외", () => {
    expect(ACTIVE_CLIENT_STAGES).toEqual(["ONBOARDING", "KEYWORD", "GEO", "CONTENT", "LIVE"]);
    expect(ACTIVE_CLIENT_STAGES).not.toContain("PAUSED");
    expect(ACTIVE_CLIENT_STAGES).not.toContain("CHURNED");
  });
});

describe("client-stages · 전이 규칙", () => {
  it("다음 단계로 전진 허용", () => {
    expect(canTransitionClientStage("ONBOARDING", "KEYWORD")).toBe(true);
    expect(canTransitionClientStage("KEYWORD", "GEO")).toBe(true);
    expect(canTransitionClientStage("GEO", "CONTENT")).toBe(true);
    expect(canTransitionClientStage("CONTENT", "LIVE")).toBe(true);
  });
  it("1단계 후진(정정) 허용, 2단계 점프 금지", () => {
    expect(canTransitionClientStage("GEO", "KEYWORD")).toBe(true);
    expect(canTransitionClientStage("GEO", "ONBOARDING")).toBe(false); // 2단계 점프
    expect(canTransitionClientStage("ONBOARDING", "GEO")).toBe(false); // 2단계 점프
  });
  it("어느 활성 단계서든 일시중지·해지 가능", () => {
    for (const s of ACTIVE_CLIENT_STAGES) {
      expect(canTransitionClientStage(s, "PAUSED")).toBe(true);
      expect(canTransitionClientStage(s, "CHURNED")).toBe(true);
    }
  });
  it("일시중지→활성 복귀, 해지→재개(ONBOARDING)", () => {
    expect(canTransitionClientStage("PAUSED", "LIVE")).toBe(true);
    expect(canTransitionClientStage("PAUSED", "GEO")).toBe(true);
    expect(canTransitionClientStage("CHURNED", "ONBOARDING")).toBe(true);
    expect(canTransitionClientStage("CHURNED", "LIVE")).toBe(false);
  });
});

describe("client-stages · suggestNextStage(자동 전환 제안)", () => {
  const none: StageSignals = { hasKeywords: false, hasGeoMonitoring: false, hasContentPlan: false, hasPublished: false };
  it("신호 충족 시 다음 단계 제안, 유효한 전진만", () => {
    expect(suggestNextStage("ONBOARDING", { ...none, hasKeywords: true })).toBe("KEYWORD");
    expect(suggestNextStage("KEYWORD", { ...none, hasGeoMonitoring: true })).toBe("GEO");
    expect(suggestNextStage("GEO", { ...none, hasContentPlan: true })).toBe("CONTENT");
    expect(suggestNextStage("CONTENT", { ...none, hasPublished: true })).toBe("LIVE");
    // 제안은 항상 유효한 전이
    expect(canTransitionClientStage("ONBOARDING", "KEYWORD")).toBe(true);
  });
  it("신호 없으면 제안 없음, 운영·중지·해지는 제안 없음", () => {
    expect(suggestNextStage("ONBOARDING", none)).toBeNull();
    expect(suggestNextStage("KEYWORD", { ...none, hasKeywords: true })).toBeNull(); // GEO 신호 없음
    expect(suggestNextStage("LIVE", { hasKeywords: true, hasGeoMonitoring: true, hasContentPlan: true, hasPublished: true })).toBeNull();
    expect(suggestNextStage("PAUSED", none)).toBeNull();
  });
});

describe("client-stages · computeStageSla(단계 SLA)", () => {
  const now = new Date("2026-07-19T00:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it("온보딩 3일: 0~1일 여유, 2일 임박, 3일↑ 지연", () => {
    expect(computeStageSla("ONBOARDING", daysAgo(0), now).status).toBe("ok");
    expect(computeStageSla("ONBOARDING", daysAgo(1), now).status).toBe("ok");
    expect(computeStageSla("ONBOARDING", daysAgo(2), now).status).toBe("warn");
    const over = computeStageSla("ONBOARDING", daysAgo(5), now);
    expect(over.status).toBe("breach");
    expect(over.daysInStage).toBe(5);
    expect(over.overdueDays).toBe(2); // 5 - 3
  });
  it("운영·중지·해지는 SLA 없음(항상 ok, limit null)", () => {
    for (const s of ["LIVE", "PAUSED", "CHURNED"] as const) {
      const sla = computeStageSla(s, daysAgo(100), now);
      expect(sla.limitDays).toBeNull();
      expect(sla.status).toBe("ok");
    }
  });
  it("since 없으면 지연으로 몰지 않고 0일 처리", () => {
    const sla = computeStageSla("ONBOARDING", null, now);
    expect(sla.daysInStage).toBe(0);
    expect(sla.status).toBe("ok");
  });
  it("미래 시각(음수 경과)도 0으로 방어", () => {
    expect(computeStageSla("KEYWORD", daysAgo(-3), now).daysInStage).toBe(0);
  });
});

describe("client-stages · 파싱·진행률", () => {
  it("isClientStage / toClientStage 폴백", () => {
    expect(isClientStage("GEO")).toBe(true);
    expect(isClientStage("NOPE")).toBe(false);
    expect(toClientStage("CONTENT")).toBe("CONTENT");
    expect(toClientStage("레거시")).toBe("ONBOARDING");
    expect(toClientStage(null)).toBe("ONBOARDING");
  });
  it("진행률은 배정 0% → 운영 100%", () => {
    expect(clientStageProgress("ONBOARDING")).toBe(0);
    expect(clientStageProgress("GEO")).toBe(50);
    expect(clientStageProgress("LIVE")).toBe(100);
    expect(clientStageProgress("PAUSED")).toBe(0);
    expect(clientStageProgress("CHURNED")).toBe(0);
  });
});
