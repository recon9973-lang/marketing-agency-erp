import { describe, expect, it, vi } from "vitest";
import { complianceVerdict, recordComplianceLog } from "@/server/compliance/log";

describe("ComplianceLog 헬퍼(§4)", () => {
  it("판정 규칙: high→BLOCK, medium→WARN, 없음→PASS", () => {
    expect(complianceVerdict(1, 0)).toBe("BLOCK");
    expect(complianceVerdict(0, 2)).toBe("WARN");
    expect(complianceVerdict(0, 0)).toBe("PASS");
  });

  it("recordComplianceLog가 판정을 계산해 create를 호출한다", async () => {
    const create = vi.fn().mockResolvedValue({});
    const tx = { complianceLog: { create } } as unknown as Parameters<typeof recordComplianceLog>[0];
    await recordComplianceLog(tx, {
      clientId: "c1",
      targetType: "ContentPlan",
      targetId: "p1",
      highCount: 2,
      mediumCount: 1,
      flags: ["최고", "완치"],
      orgId: "o1",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetType: "ContentPlan", targetId: "p1", verdict: "BLOCK", highCount: 2, mediumCount: 1 }),
      }),
    );
  });
});
