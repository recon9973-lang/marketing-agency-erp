// GEO Studio · M4 Path Analyzer — AI 클라이언트(목) (원본 clients.py 목 경로 이식).
// ⚠️ dev/데모 전용 결정적 목(파이썬 RNG와 무관). 라이브 4-AI는 P0 LLM 레이어에서 주입.
import { createHash } from "node:crypto";

export const PATH_PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity"] as const;

const MOCK_DOMAINS = ["blog.naver.com", "brunch.co.kr", "tistory.com"];
const HIT: Record<string, number> = { chatgpt: 0.4, gemini: 0.6, claude: 0.35, perplexity: 0.55 };
const SUFFIXES = ["가격", "예약 방법", "후기", "위치", "추천 이유", "비교", "칼로리", "주차", "할인", "성수기"];
const URL_RE = /https?:\/\/[^\s)\]}"']+/g;

function seeded(seedStr: string) {
  let buf = createHash("sha256").update(seedStr).digest();
  let i = 0;
  const byte = () => {
    if (i >= buf.length) {
      buf = createHash("sha256").update(buf).digest();
      i = 0;
    }
    return buf[i++];
  };
  return {
    rand: () => byte() / 256,
    range: (n: number) => (n <= 0 ? 0 : byte() % n),
    sample: <T>(arr: readonly T[], k: number): T[] => {
      const pool = [...arr];
      const out: T[] = [];
      for (let j = 0; j < k && pool.length; j++) out.push(pool.splice(byte() % pool.length, 1)[0]);
      return out;
    }
  };
}

function slug(nm: string): number {
  const h = createHash("sha256").update(nm).digest();
  return h.readUInt32BE(0) % 9999;
}

export type AiAnswer = { platform: string; text: string; urls: string[]; mocked: boolean; error: string | null };

export function mockAnswer(platform: string, query: string, brand: string, competitors: string[]): string {
  const rng = seeded(`${platform}|${query}|${brand}`);
  const names = [...competitors, "로컬업체A", "로컬업체B"];
  const lines = ["추천 결과입니다."];
  if (rng.rand() < (HIT[platform] ?? 0.45)) names.splice(rng.range(Math.max(1, names.length)), 0, brand);
  names.slice(0, 4).forEach((nm, idx) => {
    const dom = MOCK_DOMAINS[rng.range(MOCK_DOMAINS.length)];
    lines.push(`${idx + 1}. ${nm} — https://${dom}/${slug(nm)}`);
  });
  return lines.join("\n");
}

export function mockFollowups(query: string, k: number): string[] {
  const base = query.replaceAll(" 추천", "").replaceAll("추천", "").trim();
  const available = SUFFIXES.filter((s) => !base.includes(s));
  const rng = seeded(query);
  const picks = available.length ? rng.sample(available, Math.min(k, available.length)) : [];
  return picks.map((sfx) => `${base} ${sfx}`.trim());
}

/** 4대 AI 목 응답 수집. */
export function queryAllAis(query: string, brand: string, competitors: string[], platforms: readonly string[] = PATH_PLATFORMS): AiAnswer[] {
  return platforms.map((p) => {
    const text = mockAnswer(p, query, brand, competitors);
    return { platform: p, text, urls: text.match(URL_RE) ?? [], mocked: true, error: null };
  });
}

export function extractFollowups(query: string, k: number): string[] {
  return mockFollowups(query, k);
}
