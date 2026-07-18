// GEO Studio · M4 Path Analyzer — AI 질문 여정 재귀 탐색 (원본 journey.py 이식, 목 기반).
import { pyRound } from "../py-compat";
import { extractFollowups, queryAllAis, type AiAnswer } from "./clients";
import { makeNode, type JourneyNode, type JourneyTree } from "./models";

function norm(s: string): string {
  return s.normalize("NFKC").toLowerCase().trim();
}

/** 응답 묶음에서 브랜드 언급 여부/강도/인용URL/언급AI 집계. */
export function mentionInfo(answers: AiAnswer[], brand: string): { mentioned: boolean; strength: number; urls: string[]; ais: string[] } {
  const valid = answers.filter((a) => !a.error);
  const hitAis: string[] = [];
  let urls: string[] = [];
  const nb = norm(brand);
  for (const a of valid) {
    if (norm(a.text).includes(nb)) hitAis.push(a.platform);
    urls = urls.concat(a.urls);
  }
  const mentioned = hitAis.length > 0;
  const strength = valid.length ? pyRound(hitAis.length / valid.length, 3) : 0.0;
  return { mentioned, strength, urls: [...new Set(urls)].sort(), ais: hitAis };
}

export type ExploreOptions = { competitors?: string[]; platforms?: string[]; maxDepth?: number; followUpK?: number };

/** 여정 트리를 만든다(목 기반·결정적). */
export function exploreJourney(seedQuery: string, brand: string, opts: ExploreOptions = {}): JourneyTree {
  const competitors = opts.competitors ?? [];
  const platforms = opts.platforms;
  const maxDepth = opts.maxDepth ?? 3;
  const followUpK = opts.followUpK ?? 2;

  const explore = (query: string, depth: number): JourneyNode => {
    const answers = queryAllAis(query, brand, competitors, platforms);
    const info = mentionInfo(answers, brand);
    const node = makeNode({
      query,
      depth,
      brandMentioned: info.mentioned,
      mentionStrength: info.strength,
      citedUrls: info.urls,
      aiSources: info.ais
    });
    if (depth < maxDepth) {
      const followUps = extractFollowups(query, followUpK);
      node.children = followUps.map((q) => explore(q, depth + 1));
    }
    return node;
  };

  const root = explore(seedQuery, 0);
  return { brand, seedQuery, root, maxDepth };
}
