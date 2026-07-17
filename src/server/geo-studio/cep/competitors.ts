// GEO Studio · M2 CEP 파인더 — 경쟁사 CEP 맵핑 (원본 competitors.py 이식).
import { pyRound } from "../py-compat";
import type { Cep, CepCandidate, CompetitorCep } from "./models";

export function competitorToRow(r: CompetitorCep): Record<string, unknown> {
  return { competitor_name: r.competitorName, cep_text: r.cepText, mention_strength: r.mentionStrength, source_ai: r.sourceAi };
}

/** CEP 클러스터 멤버에서 경쟁사 인용 강도를 계산(강도 내림차순). */
export function buildCompetitorMap(cep: Cep, members: CepCandidate[]): CompetitorCep[] {
  if (members.length === 0) return [];
  const total = members.length;
  const byComp = new Map<string, CepCandidate[]>(); // 첫 등장 순서 보존
  for (const m of members) {
    for (const c of m.competitorsMentioned) {
      if (!byComp.has(c)) byComp.set(c, []);
      byComp.get(c)!.push(m);
    }
  }
  const rows: CompetitorCep[] = [];
  for (const [name, hits] of byComp) {
    const aiVotes = new Map<string, number>();
    for (const h of hits) aiVotes.set(h.sourceAi, (aiVotes.get(h.sourceAi) ?? 0) + 1);
    let sourceAi = "";
    let bestV = -1;
    for (const [ai, v] of aiVotes) if (v > bestV) ((bestV = v), (sourceAi = ai)); // 동점→첫 등장
    rows.push({ competitorName: name, cepText: cep.cepText, mentionStrength: pyRound(hits.length / total, 3), sourceAi });
  }
  // 강도 내림차순(안정 정렬 — 동점은 원래 순서)
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.mentionStrength - a.r.mentionStrength || a.i - b.i)
    .map((x) => x.r);
}

/** 경쟁사별 점유 CEP 비율(%) + 자사(_brand). */
export function shareOfCeps(ceps: Cep[], competitors: string[]): Record<string, number> {
  const total = ceps.length || 1;
  const share: Record<string, number> = {};
  for (const name of competitors) {
    const occupied = ceps.filter((c) => c.competitorNames.includes(name)).length;
    share[name] = pyRound((occupied / total) * 100, 1);
  }
  const brandOccupied = ceps.filter((c) => c.brandMentionCount > 0).length;
  share["_brand"] = pyRound((brandOccupied / total) * 100, 1);
  return share;
}

export function whitespaceCeps(ceps: Cep[]): Cep[] {
  return ceps.filter((c) => c.isWhitespace);
}

export function overlapCeps(ceps: Cep[]): Cep[] {
  return ceps.filter((c) => c.brandMentionCount > 0 && c.competitorNames.length > 0);
}
