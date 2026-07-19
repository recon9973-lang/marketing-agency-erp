// 실측 임베딩 — OpenAI text-embedding-3(기본 small, 1536d). 키 있으면 켜짐(원칙 유지).
// GEO CEP 군집의 의미 벡터로 사용. 한국어 다국어 지원. 비용 ~$0.02/1M 토큰(사실상 무시 가능).
// 미설정 시 명확한 에러 → 호출부는 "데모/미연결"로 강등(가짜 벡터를 실측처럼 쓰지 않음).
const EMBED_ENDPOINT = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-small";
const BATCH = 256; // 한 요청당 입력 수(과대 페이로드 방지)

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * 텍스트 배열 → 임베딩 벡터 배열(입력 순서 보존). 미설정 시 throw.
 * L2 정규화된 벡터를 반환(text-embedding-3는 정규화되어 나오지만 안전하게 재정규화).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("EMBEDDINGS_NOT_CONFIGURED");
  const model = process.env.OPENAI_EMBED_MODEL || DEFAULT_MODEL;
  if (texts.length === 0) return [];

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const chunk = texts.slice(i, i + BATCH);
    const res = await fetch(EMBED_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: chunk })
    });
    if (!res.ok) throw new Error(`임베딩 API 오류 (${res.status})`);
    const json = (await res.json()) as { data?: { embedding: number[]; index: number }[] };
    const rows = (json.data ?? []).sort((a, b) => a.index - b.index).map((d) => normalize(d.embedding));
    if (rows.length !== chunk.length) throw new Error("임베딩 응답 개수 불일치");
    out.push(...rows);
  }
  return out;
}

function normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}
