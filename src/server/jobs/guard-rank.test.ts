import { describe, it, expect } from "vitest";
import { decideGuardAlert } from "./guard-rank";

describe("decideGuardAlert — 월보장 순위 알림 판정", () => {
  it("미노출(rank=null)이면 이탈 CRIT", () => {
    const a = decideGuardAlert(null, 1, 1);
    expect(a?.type).toBe("GUARD_RANK_UNEXPOSED");
  });

  it("목표순위보다 떨어지면 목표 미달", () => {
    const a = decideGuardAlert(5, 1, 4);
    expect(a?.type).toBe("GUARD_RANK_BELOW_TARGET");
    expect(a?.level).toContain("목표 1위");
  });

  it("목표 이내면 알림 없음", () => {
    expect(decideGuardAlert(1, 1, 1)).toBeNull();
    expect(decideGuardAlert(2, 3, 2)).toBeNull();
  });

  it("직전 대비 4위 이상 급락하면 DROP", () => {
    const a = decideGuardAlert(9, null, 3); // 목표 미설정, 3→9 급락
    expect(a?.type).toBe("GUARD_RANK_DROP");
  });

  it("소폭 하락(3위 이내)은 알림 없음", () => {
    expect(decideGuardAlert(6, null, 3)).toBeNull();
  });

  it("우선순위: 미노출 > 목표미달 > 급락", () => {
    // rank=null 이면 targetRank/prevRank 있어도 무조건 이탈
    expect(decideGuardAlert(null, 1, 1)?.type).toBe("GUARD_RANK_UNEXPOSED");
    // 목표 미달과 급락 동시 조건이면 목표 미달 우선
    expect(decideGuardAlert(10, 1, 3)?.type).toBe("GUARD_RANK_BELOW_TARGET");
  });
});
