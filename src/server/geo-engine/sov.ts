// 목표 경로: src/server/geo-engine/sov.ts
//
// GEO Share of Voice — 자사 vs 경쟁사 AI 노출 점유율(상대지표). 순수 함수(DB·네트워크 없음) — 단위 테스트 대상.
// 원칙: 절대 인용%가 아니라 self /(self + 경쟁사 언급 합). 아무도 언급 없으면 null(측정불가).
// 입력은 GeoAnswerRecord 최신 관측(질문×엔진)에서 파생 — 저장 없음(매 조회 파생).

export type SovCell = { appeared: boolean; competitors: string[] };

export type SovResult = {
  selfMentions: number; // 자사 출현 셀 수
  competitorMentions: Record<string, number>; // 경쟁사별 언급 수
  totalCompetitor: number; // 경쟁사 언급 총합
  sovPct: number | null; // self /(self + comp) · 언급 0이면 null
};

/** Prisma Json(GeoAnswerRecord.competitorsMentioned) → string[] 안전 변환 */
export function asCompetitors(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function buildSov(cells: SovCell[]): SovResult {
  let selfMentions = 0;
  const competitorMentions: Record<string, number> = {};
  for (const c of cells) {
    if (c?.appeared) selfMentions++;
    for (const name of c?.competitors ?? []) {
      competitorMentions[name] = (competitorMentions[name] ?? 0) + 1;
    }
  }
  const totalCompetitor = Object.values(competitorMentions).reduce((a, b) => a + b, 0);
  const denom = selfMentions + totalCompetitor;
  return {
    selfMentions,
    competitorMentions,
    totalCompetitor,
    sovPct: denom ? Math.round((selfMentions / denom) * 100) : null
  };
}
