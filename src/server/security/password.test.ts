import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password · 맥↔윈도우 모호문자 통일", () => {
  it("맥에서 설정한 백슬래시 비번을 윈도우 원화(₩)로 쳐도 로그인된다", () => {
    const hash = hashPassword("venom\\2026"); // 맥: 백슬래시
    expect(verifyPassword("venom₩2026", hash)).toBe(true); // 윈도우: 원화 키
    expect(verifyPassword("venom\\2026", hash)).toBe(true); // 맥에서도 그대로
  });
  it("스마트 따옴표(맥 자동교정)와 직선 따옴표가 호환된다", () => {
    const hash = hashPassword("it's-me"); // 직선
    expect(verifyPassword("it’s-me", hash)).toBe(true); // 맥 스마트 따옴표
  });
  it("알파벳/숫자 비번은 영향 없음(정상 매칭·불일치 거부)", () => {
    const hash = hashPassword("Venom2026");
    expect(verifyPassword("Venom2026", hash)).toBe(true);
    expect(verifyPassword("Venom2027", hash)).toBe(false);
  });
  it("전각·양끝 공백도 흡수(기존 NFKC/trim 유지)", () => {
    const hash = hashPassword("abc123");
    expect(verifyPassword("  ａｂｃ１２３ ", hash)).toBe(true); // 전각+공백
  });
});
