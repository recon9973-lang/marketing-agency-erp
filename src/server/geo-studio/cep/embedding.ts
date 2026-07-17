// GEO Studio · M2 CEP 파인더 — 임베딩 (원본 clients._mock_embedding 이식).
// 키 없이 동작하는 결정적 해시 벡터. sha256 누적이라 파이썬과 바이트 동등.
// (실 임베딩 API는 P0 LLM 레이어에서 embed()로 주입 예정.)
import { createHash } from "node:crypto";

export const DEFAULT_EMBED_DIM = 1536;

/** 텍스트로 시드를 고정한 결정적 단위벡터. 유사 문장이 가깝도록 토큰 해시를 누적. */
export function mockEmbedding(text: string, dim: number = DEFAULT_EMBED_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  let tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) tokens = [text.toLowerCase()];
  for (const tok of tokens) {
    const h = createHash("sha256").update(tok, "utf8").digest(); // 32 bytes
    for (let i = 0; i < h.length; i += 4) {
      const idx = h.readUInt32BE(i) % dim;
      vec[idx] += 1.0;
    }
  }
  const norm = Math.sqrt(vec.reduce((a, v) => a + v * v, 0)) || 1.0;
  return vec.map((v) => v / norm);
}

/** 문장 리스트 → 목 임베딩. */
export function mockEmbedTexts(texts: string[], dim: number = DEFAULT_EMBED_DIM): number[][] {
  return texts.map((t) => mockEmbedding(t, dim));
}
