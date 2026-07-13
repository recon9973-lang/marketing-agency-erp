import { describe, expect, it } from "vitest";
import { redactPII, hasPII } from "@/server/compliance/pii";

describe("PII 마스킹(§9 AI사용 익명화)", () => {
  it("주민등록번호를 마스킹한다", () => {
    const r = redactPII("환자 900101-1234567 님");
    expect(r.text).toBe("환자 [주민번호] 님");
    expect(r.found.rrn).toBe(1);
  });

  it("전화번호·이메일·카드번호를 마스킹한다", () => {
    const r = redactPII("연락처 010-1234-5678, hong@test.com, 카드 1234-5678-9012-3456");
    expect(r.text).toContain("[전화번호]");
    expect(r.text).toContain("[이메일]");
    expect(r.text).toContain("[카드번호]");
    expect(r.total).toBe(3);
  });

  it("PII가 없으면 원문을 유지한다", () => {
    const clean = "임플란트 시술은 치아를 대체하는 방법입니다.";
    const r = redactPII(clean);
    expect(r.text).toBe(clean);
    expect(r.total).toBe(0);
    expect(hasPII(clean)).toBe(false);
  });

  it("hasPII는 포함 여부를 반환한다", () => {
    expect(hasPII("주민번호 900101-1234567")).toBe(true);
  });
});
