// GEO Studio · M2 CEP 파인더 — AI 클라이언트(목) (원본 clients.py의 목 경로 이식).
// ⚠️ 라이브 4-AI 호출은 P0 공용 LLM 레이어에서 주입 예정. 여기 목은 dev/데모 전용이며
//   파이썬 RNG(MT19937)와 바이트 동일할 필요가 없어 TS 네이티브 결정적 시드로 구현한다.
//   (extract가 파싱할 수 있도록 원본과 동일한 "{맥락} {상호} — ..." 문장 형식만 유지)
import { createHash } from "node:crypto";

export const CEP_PLATFORMS = ["chatgpt", "gemini", "claude", "perplexity"] as const;

const MOCK_CONTEXTS = [
  "아이와 함께 가기 좋은", "혼자 조용히 쉬기 좋은", "반려동물과 함께할 수 있는",
  "주말 나들이로 딱인", "특별한 기념일에 어울리는", "가성비가 뛰어난",
  "접근성이 좋아 급할 때 찾는", "친구들과 방문하기 좋은", "부모님 모시고 가기 좋은",
  "평일 저녁에 여유롭게 즐기는", "요즘 SNS에서 뜨는", "믿고 맡길 수 있는"
];
const MOCK_HIT_RATE: Record<string, number> = { chatgpt: 0.4, gemini: 0.6, claude: 0.35, perplexity: 0.55 };
const FILLER = ["햇살숙소", "블루하우스", "코지스테이", "그린펜션", "도심리조트"];

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
    range: (n: number) => (n <= 0 ? 0 : byte() % n),
    sample: <T>(arr: readonly T[], k: number): T[] => {
      const pool = [...arr];
      const out: T[] = [];
      for (let j = 0; j < k && pool.length; j++) out.push(pool.splice(byte() % pool.length, 1)[0]);
      return out;
    }
  };
}

/** 결정적 목 응답 — 상황·맥락이 담긴 추천 문장을 생성(파이썬 mock_response의 TS 대체). */
export function mockResponse(platform: string, prompt: string, brand: string, competitors: string[]): string {
  const rng = seeded(`${platform}|${prompt}|${brand}`);
  const ctxs = rng.sample(MOCK_CONTEXTS, 3);

  const names = [...FILLER];
  if (rng.rand() < (MOCK_HIT_RATE[platform] ?? 0.45)) names.splice(rng.range(3), 0, brand);
  for (const c of competitors) if (rng.rand() < 0.4) names.splice(rng.range(names.length), 0, c);
  const picks = names.slice(0, 4);

  const doubled = [...ctxs, ...ctxs];
  const lines = ["질문하신 내용에 대해 상황별로 추천드립니다."];
  picks.forEach((name, idx) => {
    const ctx = doubled[idx] ?? doubled[0];
    lines.push(`${idx + 1}. ${ctx} ${name} — 해당 맥락에서 평판이 좋습니다.`);
  });
  lines.push("방문 전 예약 가능 여부와 이용 시간을 확인하세요.");
  return lines.join("\n");
}
