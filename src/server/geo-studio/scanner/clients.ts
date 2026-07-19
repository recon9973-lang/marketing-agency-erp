// GEO Studio · M1 GEO 스캐너 — 4-AI 클라이언트(목) (원본 clients.py의 목 경로 이식).
// ⚠️ 라이브 4-AI 호출(ChatGPT·Gemini·Claude·Perplexity)은 P0 공용 LLM 레이어에서 주입 예정.
//   여기 목은 dev/데모 전용이며 파이썬 RNG(MT19937)와 바이트 동일할 필요가 없어 TS 네이티브
//   결정적 시드로 구현한다(detector가 파싱할 수 있게 원본과 동일한 추천 문장 형식만 유지).
import { createHash } from "node:crypto";
import { ENGINE_ADAPTERS } from "@/server/geo-engine/engines";

export const SCAN_PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity"] as const;

// 스캐너 플랫폼(소문자) → geo-engine 어댑터 엔진명(대문자) 매핑.
const PLATFORM_TO_ENGINE: Record<string, string> = {
  chatgpt: "CHATGPT",
  gemini: "GEMINI",
  claude: "CLAUDE",
  perplexity: "PERPLEXITY"
};

/** 이 플랫폼의 실측 어댑터가 연결(키 설정)됐는지. */
export function platformLive(platform: string): boolean {
  const engine = PLATFORM_TO_ENGINE[platform];
  return ENGINE_ADAPTERS.some((a) => a.engine === engine && a.configured());
}

/** 하나라도 실측 엔진이 연결됐는지(화면 배지·분기용). */
export function anyPlatformLive(): boolean {
  return SCAN_PLATFORMS.some((p) => platformLive(p));
}
export type ScanPlatform = (typeof SCAN_PLATFORMS)[number];

export type AIResponse = {
  platform: string;
  text: string;
  responseMs: number;
  mocked: boolean;
  error: string | null;
};

// 플랫폼별 대략적 언급 확률 — 기획안 2-2의 '측정 신뢰도'를 반영한 데모용 값.
const MOCK_HIT_RATE: Record<string, number> = { chatgpt: 0.35, gemini: 0.6, claude: 0.3, perplexity: 0.5 };
const FILLER = ["A한의원", "B한의원", "C클리닉", "서울메디컬", "강남헬스케어"];

/** sha256 스트림 기반 결정적 시드 RNG(파이썬 RNG와 무관, dev 목 전용). */
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
    range: (n: number) => (n <= 0 ? 0 : byte() % n)
  };
}

/** (platform, prompt, brand)로 시드를 고정한 결정적 가짜 응답. */
export function mockResponse(platform: string, prompt: string, brand: string, competitors: string[]): string {
  const rng = seeded(`${platform}|${prompt}|${brand}`);

  const names = [...FILLER];
  if (rng.rand() < (MOCK_HIT_RATE[platform] ?? 0.4)) names.splice(rng.range(3), 0, brand);
  for (const c of competitors) if (rng.rand() < 0.4) names.splice(rng.range(names.length), 0, c);

  const picks = names.slice(0, 4);
  const lines = ["문의하신 내용에 대해 다음 곳들을 추천드립니다."];
  picks.forEach((name, idx) => lines.push(`${idx + 1}. ${name} — 해당 분야에서 후기와 평판이 좋은 편입니다.`));
  lines.push("방문 전 진료 시간과 예약 여부를 확인하시기 바랍니다.");
  return lines.join("\n");
}

/**
 * 실측 우선 질의 — 해당 플랫폼의 geo-engine 어댑터가 연결됐으면 실제 AI를 호출(mocked:false),
 * 아니면 목으로 폴백(mocked:true). 실호출 실패는 예외 대신 error로 반환(집계에서 분모 제외).
 */
export async function queryAiLive(
  platform: string,
  prompt: string,
  brand: string,
  competitors: string[]
): Promise<AIResponse> {
  const engine = PLATFORM_TO_ENGINE[platform];
  const adapter = ENGINE_ADAPTERS.find((a) => a.engine === engine && a.configured());
  if (!adapter) return queryAi(platform, prompt, brand, competitors); // 미연결 → 목
  const t0 = Date.now();
  try {
    const ans = await adapter.ask(prompt);
    return { platform, text: ans.text, responseMs: Date.now() - t0, mocked: false, error: null };
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    return { platform, text: "", responseMs: Date.now() - t0, mocked: false, error: msg.slice(0, 120) };
  }
}

/** 한 플랫폼에 프롬프트 1개를 보낸다. 라이브 키가 없으면 목 응답. 실패해도 예외 대신 error 반환. */
export function queryAi(platform: string, prompt: string, brand: string, competitors: string[]): AIResponse {
  try {
    // 라이브 레이어 주입 전까지는 항상 목. responseMs는 결정적(시드 기반)으로 고정한다.
    const rng = seeded(`ms|${platform}|${prompt}`);
    const responseMs = 400 + rng.range(600);
    return { platform, text: mockResponse(platform, prompt, brand, competitors), responseMs, mocked: true, error: null };
  } catch (exc) {
    const name = exc instanceof Error ? exc.constructor.name : "Error";
    const msg = exc instanceof Error ? exc.message : String(exc);
    return { platform, text: "", responseMs: 0, mocked: false, error: `${name}: ${msg}` };
  }
}
