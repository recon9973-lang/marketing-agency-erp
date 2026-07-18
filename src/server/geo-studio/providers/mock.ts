// GEO Studio · 목(mock) 프로바이더 — Charter §4. 결정적(seed 기반), 네트워크 없음.
// 기존 모듈의 목 로직과 동일 계열(dev/데모/테스트 기본값). 네이버 실측은 naver.ts(P2).
import { createHash } from "node:crypto";
import { queryAi } from "../scanner/clients";
import type { Demographics, ProviderField, SearchDataPort, SerpDoc, VolumePoint } from "./port";

function seeded(s: string) {
  let buf = createHash("sha256").update(s).digest();
  let i = 0;
  return () => {
    if (i >= buf.length) {
      buf = createHash("sha256").update(buf).digest();
      i = 0;
    }
    return buf[i++];
  };
}

export class MockProvider implements SearchDataPort {
  readonly id = "mock";
  tierOf(_field: ProviderField): "approx" {
    return "approx"; // 목은 전부 근사(실측 아님) — 배지에서 명확히 구분.
  }

  async searchVolume(keyword: string, period: "y" | "m" | "d"): Promise<VolumePoint[]> {
    const n = period === "y" ? 5 : period === "m" ? 12 : 30;
    const b = seeded(`vol|${keyword}|${period}`);
    return Array.from({ length: n }, (_, i) => ({ period: `${period}${i + 1}`, value: 500 + b() * 20 }));
  }

  async relatedKeywords(seed: string): Promise<string[]> {
    const suffix = ["추천", "가격", "후기", "비교", "순위", "효능", "부작용", "종류"];
    return suffix.map((s) => `${seed} ${s}`);
  }

  async serpTop(keyword: string, limit = 10): Promise<SerpDoc[]> {
    const b = seeded(`serp|${keyword}`);
    return Array.from({ length: limit }, (_, i) => ({
      rank: i + 1,
      title: `${keyword} 관련 상위 문서 ${i + 1}`,
      url: `https://example.com/${b()}${i}`,
      snippet: `${keyword}에 대한 문맥 스니펫 ${i + 1}.`,
      source: i % 2 ? "blog" : "webkr"
    }));
  }

  async demographics(keyword: string): Promise<Demographics | null> {
    const b = seeded(`demo|${keyword}`);
    return {
      byGender: { 남성: 40 + (b() % 20), 여성: 40 + (b() % 20) },
      byAge: { "10대": b() % 20, "20대": b() % 30, "30대": b() % 30, "40대": b() % 20, "50대": b() % 15 }
    };
  }

  async aiAnswers(prompt: string, platform: string): Promise<string> {
    // 기존 스캐너 목과 동일 계열(브랜드/경쟁사 인자는 상위에서 프롬프트에 반영됨).
    return queryAi(platform, prompt, "", []).text;
  }
}
