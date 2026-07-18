// GEO Studio · M1 GEO 스캐너 — 결정적 로직 골든 테스트(파이썬 동등성).
// 픽스처는 원본 geo_scanner를 고정 입력으로 실행해 생성(RNG 목 응답은 dev 전용이라 제외).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { detect, normalize, splitSentences } from "./detector";
import { buildQueries, generateVariations, promptFor } from "./queries";
import { aggregate, mentionRate, type ScanResult } from "./analytics";

const g = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/m1.golden.json"), "utf8"));

// asdict(ScanResult)의 snake_case → TS ScanResult(camelCase) 매핑.
function fromPy(r: Record<string, unknown>): ScanResult {
  return {
    platform: r.platform as string,
    keyword: r.keyword as string,
    variation: r.variation as string,
    prompt: r.prompt as string,
    responseText: r.response_text as string,
    mentioned: r.mentioned as boolean,
    mentionCount: r.mention_count as number,
    contexts: r.contexts as string[],
    responseMs: r.response_ms as number,
    mocked: r.mocked as boolean,
    error: (r.error as string | null) ?? null,
    competitorHits: (r.competitor_hits as Record<string, boolean>) ?? {}
  };
}

describe("M1 queries", () => {
  it("buildQueries가 변형 목록과 동일", () => {
    const rows = buildQueries(g.queries.keywords, 3).map((q) => ({ keyword: q.keyword, variation: q.variation, text: q.text }));
    expect(rows).toEqual(g.queries.variations);
  });

  it("promptFor가 AI별 프롬프트와 동일", () => {
    const vs = generateVariations("강남 한의원", 3);
    for (const q of vs) {
      const expected = g.queries.prompts[q.variation];
      for (const p of Object.keys(expected)) {
        expect(promptFor(q, p)).toBe(expected[p]);
      }
    }
  });
});

describe("M1 normalize/split", () => {
  it("normalize NFKC·소문자·공백축약", () => {
    for (const [input, out] of Object.entries(g.normalize)) {
      expect(normalize(input)).toBe(out);
    }
  });

  it("splitSentences 문장 분리", () => {
    expect(splitSentences(g.detect[0].text)).toEqual(g.split_sentences);
  });
});

describe("M1 detect", () => {
  it("모든 감지 케이스가 파이썬과 동일", () => {
    for (const c of g.detect) {
      expect(detect(c.text, c.brand, c.window)).toEqual(c.result);
    }
  });
});

describe("M1 aggregate", () => {
  const results = (g.aggregate.input as Record<string, unknown>[]).map(fromPy);

  it("mentionRate", () => {
    expect(mentionRate(results)).toBe(g.aggregate.rates.mention_rate_all);
    expect(mentionRate([])).toBe(g.aggregate.rates.mention_rate_empty);
  });

  it("aggregate 집계 결과가 파이썬과 동일", () => {
    const out = aggregate(results, "베놈한의원", ["경쟁A", "경쟁B"]);
    expect(out).toEqual(g.aggregate.output);
  });
});
