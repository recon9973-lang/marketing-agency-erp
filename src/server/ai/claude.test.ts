import { describe, expect, it } from "vitest";
import { extractJson } from "./claude";

// 모든 AI 기능의 JSON 파싱 관문 — Claude가 프로즈·코드펜스로 감싸도 견고해야 한다.
describe("extractJson — Claude 응답 JSON 추출", () => {
  it("순수 JSON 그대로 파싱", () => {
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("```json 코드펜스 안의 JSON 파싱", () => {
    const text = "다음은 결과입니다:\n```json\n{\"keyword\": \"강남 한의원\", \"priority\": 1}\n```\n감사합니다.";
    expect(extractJson<{ keyword: string; priority: number }>(text)).toEqual({ keyword: "강남 한의원", priority: 1 });
  });

  it("언어 라벨 없는 ``` 코드펜스도 파싱", () => {
    expect(extractJson<{ ok: boolean }>("```\n{\"ok\": true}\n```")).toEqual({ ok: true });
  });

  it("서문+후문 프로즈에 둘러싸인 raw JSON 파싱(첫 {~마지막 })", () => {
    const text = "분석 결과는 아래와 같습니다. {\"items\": [1, 2, 3]} 이상입니다.";
    expect(extractJson<{ items: number[] }>(text)).toEqual({ items: [1, 2, 3] });
  });

  it("중첩 객체·배열 보존", () => {
    const text = "```json\n{\"coreKeywords\":[{\"keyword\":\"a\",\"priority\":1}],\"summary\":\"x\"}\n```";
    expect(extractJson<{ coreKeywords: { keyword: string; priority: number }[]; summary: string }>(text)).toEqual({
      coreKeywords: [{ keyword: "a", priority: 1 }],
      summary: "x"
    });
  });

  it("객체가 전혀 없으면 AI_EMPTY throw", () => {
    expect(() => extractJson("죄송합니다. 생성하지 못했습니다.")).toThrow("AI_EMPTY");
  });

  it("깨진 JSON은 파싱 에러 throw(조용히 삼키지 않음)", () => {
    expect(() => extractJson("{\"a\": }")).toThrow();
  });
});
