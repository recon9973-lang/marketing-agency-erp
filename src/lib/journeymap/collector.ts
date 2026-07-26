"use client";

import { classifyStage, isBrandKeyword } from "./classify";
import { scanRisk } from "./risk";
import { uid } from "./store";
import { CollectOptions, HospitalProfile, JNode, Stage, STAGES, STAGE_META } from "./types";

export interface CollectProgress {
  phase: "seeding" | "collecting" | "enriching" | "classifying" | "scoring" | "done";
  percent: number;
  message: string;
  naverCount: number;
  googleCount: number;
  kinCount: number;
  failedSources: string[];
}

async function fetchSuggest(q: string, source: "naver" | "google"): Promise<string[]> {
  try {
    const res = await fetch(`/api/journeymap/suggest?q=${encodeURIComponent(q)}&source=${source}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.items || [];
  } catch {
    throw new Error(source);
  }
}

async function fetchKin(q: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/journeymap/kin?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.unconfigured || data.error) throw new Error("kin");
    return data.items || [];
  } catch {
    throw new Error("kin");
  }
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function isRelevant(kw: string, mainKeyword: string, profile: HospitalProfile): boolean {
  const k = normKey(kw);
  const anchors = [mainKeyword, profile.name, ...profile.mainTreatments, ...profile.departments, ...profile.competitors]
    .filter(Boolean)
    .map(normKey);
  const head = normKey(mainKeyword).slice(0, 2);
  return anchors.some((a) => a && k.includes(a)) || (head.length >= 2 && k.includes(head));
}

export async function runCollection(
  mainKeyword: string,
  profile: HospitalProfile,
  seeds: string[],
  options: CollectOptions,
  onProgress: (p: CollectProgress) => void
): Promise<{ nodes: JNode[]; failedSources: string[] }> {
  const failedSources = new Set<string>();
  let naverCount = 0;
  let googleCount = 0;
  let kinCount = 0;

  const report = (phase: CollectProgress["phase"], percent: number, message: string) =>
    onProgress({ phase, percent, message, naverCount, googleCount, kinCount, failedSources: Array.from(failedSources) });

  report("seeding", 4, `시드 확장 완료 (${seeds.length}개)`);

  // ── 트리 뼈대
  const center: JNode = {
    id: uid(), parentId: null, keyword: mainKeyword, kind: "center", depth: 0,
    stage: null, stageConfidence: 1, stageOverridden: false, source: "user",
    score: 100, riskLevel: "none", riskReasons: [], isBrand: false, collapsed: false,
  };
  const branchByStage = {} as Record<Stage, JNode>;
  const branches = STAGES.map((stage) => {
    const b: JNode = {
      id: uid(), parentId: center.id, keyword: STAGE_META[stage].label, kind: "branch", depth: 1,
      stage, stageConfidence: 1, stageOverridden: false, source: "user",
      score: 0, riskLevel: "none", riskReasons: [], isBrand: false, collapsed: false,
    };
    branchByStage[stage] = b;
    return b;
  });

  const nodes: JNode[] = [center, ...branches];
  const seen = new Set<string>([normKey(mainKeyword)]);
  const hitCount = new Map<string, number>();

  const addKeywordNode = (kw: string, parentId: string | null, depth: number, source: JNode["source"]): JNode | null => {
    const key = normKey(kw);
    if (seen.has(key)) {
      hitCount.set(key, (hitCount.get(key) || 0) + 1);
      return null;
    }
    if (nodes.length - 5 >= options.maxNodes) return null;
    seen.add(key);
    hitCount.set(key, 1);
    const { stage, confidence } = classifyStage(kw, profile);
    const risk = scanRisk(kw);
    const node: JNode = {
      id: uid(), parentId: parentId ?? branchByStage[stage].id, keyword: kw, kind: "keyword", depth,
      stage, stageConfidence: confidence, stageOverridden: false, source,
      score: 0, riskLevel: risk.level, riskReasons: risk.reasons,
      isBrand: isBrandKeyword(kw, profile), collapsed: false,
    };
    nodes.push(node);
    return node;
  };

  // ── 시드 → depth 2
  const queue: { node: JNode; level: number }[] = [];
  for (const s of seeds) {
    const n = addKeywordNode(s, null, 2, "seed");
    if (n) queue.push({ node: n, level: 1 });
  }

  // ── BFS 수집: 자동완성(재귀) + 지식iN(시드 레벨만)
  const maxLevel = options.depth;
  const totalEstimate = Math.min(options.maxNodes, seeds.length * 12);

  while (queue.length > 0 && nodes.length - 5 < options.maxNodes) {
    const { node, level } = queue.shift()!;
    if (level > maxLevel) continue;

    const pct = Math.min(70, 8 + Math.round(((nodes.length - 5) / totalEstimate) * 62));
    report("collecting", pct, `수집 중… "${node.keyword}" (심도 ${level}/${maxLevel}, 노드 ${nodes.length - 5}개)`);

    const tasks: Promise<{ source: "naver" | "google" | "kin"; items: string[] }>[] = [];
    if (options.sources.includes("naver") && !failedSources.has("naver")) {
      tasks.push(fetchSuggest(node.keyword, "naver").then((items) => ({ source: "naver" as const, items })));
    }
    if (options.sources.includes("google") && !failedSources.has("google")) {
      tasks.push(fetchSuggest(node.keyword, "google").then((items) => ({ source: "google" as const, items })));
    }
    // 지식iN은 시드 레벨(level 1)에서만 수집 — 실제 환자 질문 문장
    if (options.sources.includes("kin") && level === 1 && !failedSources.has("kin")) {
      tasks.push(fetchKin(node.keyword).then((items) => ({ source: "kin" as const, items })));
    }

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "rejected") {
        const src = String(r.reason?.message || r.reason);
        if (src.includes("naver")) failedSources.add("naver");
        if (src.includes("google")) failedSources.add("google");
        if (src.includes("kin")) failedSources.add("kin");
        continue;
      }
      const { source, items } = r.value;
      for (const kw of items) {
        if (source !== "kin" && !isRelevant(kw, mainKeyword, profile)) continue;
        if (source === "naver") naverCount++;
        else if (source === "google") googleCount++;
        else kinCount++;
        const child = addKeywordNode(
          kw, node.id, node.depth + 1,
          source === "naver" ? "naver_ac" : source === "google" ? "google_ac" : "naver_kin"
        );
        // 지식iN 질문 문장은 재귀 수집 대상에서 제외
        if (child && source !== "kin" && level < maxLevel && queue.length < 60) {
          queue.push({ node: child, level: level + 1 });
        }
      }
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  const kwNodes = nodes.filter((n) => n.kind === "keyword");

  // ── 지표 결합: 월간 검색량·경쟁도·CPC (네이버 검색광고 API, 5개씩 배치)
  report("enriching", 74, "월간 검색량·CPC 조회 중… (네이버 검색광고 API)");
  let volumeAvailable = false;
  {
    // 상위 우선: 시드·얕은 심도 먼저, 최대 60개(12배치)
    const targets = [...kwNodes]
      .filter((n) => n.source !== "naver_kin")
      .sort((a, b) => a.depth - b.depth)
      .slice(0, 60);
    const byKey = new Map(targets.map((n) => [n.keyword, n]));
    const batches: string[][] = [];
    const keys = Array.from(byKey.keys());
    for (let i = 0; i < keys.length; i += 5) batches.push(keys.slice(i, i + 5));

    let unconfigured = false;
    for (let bi = 0; bi < batches.length && !unconfigured; bi++) {
      report("enriching", 74 + Math.round((bi / Math.max(batches.length, 1)) * 10), `검색량 조회 ${bi + 1}/${batches.length} 배치…`);
      try {
        const res = await fetch("/api/journeymap/volume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: batches[bi] }),
        });
        const data = await res.json();
        if (data.unconfigured) {
          unconfigured = true;
          break;
        }
        for (const [kw, m] of Object.entries<{ volumePc: number | null; volumeMo: number | null; competition: string | null; cpc: number | null }>(data.results || {})) {
          const n = byKey.get(kw);
          if (!n) continue;
          n.volumePc = m.volumePc;
          n.volumeMo = m.volumeMo;
          n.competition = m.competition;
          n.cpc = m.cpc;
          if (m.volumePc != null || m.volumeMo != null) volumeAvailable = true;
        }
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    if (unconfigured) failedSources.add("volume(키 미설정)");
  }

  // ── AI 분류 보정: 저신뢰(confidence < 0.65) 노드만 배치 호출 (§9.3 2차)
  if (options.useAi) {
    report("classifying", 86, "AI 여정 분류 보정 중… (저신뢰 키워드)");
    try {
      const lowConf = kwNodes.filter((n) => n.stageConfidence < 0.65 && !n.stageOverridden).slice(0, 40);
      if (lowConf.length > 0) {
        const res = await fetch("/api/journeymap/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "classify",
            mainKeyword,
            profile,
            keywords: lowConf.map((n) => ({ id: n.id, keyword: n.keyword })),
          }),
        });
        const data = await res.json();
        if (data.unconfigured) {
          failedSources.add("ai(키 미설정)");
        } else {
          const byId = new Map(kwNodes.map((n) => [n.id, n]));
          for (const [id, stage] of Object.entries<string>(data.corrections || {})) {
            const n = byId.get(id);
            if (n && n.stage !== stage) {
              n.stage = stage as Stage;
              n.stageConfidence = 0.85;
              n.aiCorrected = true;
              // 브랜치 직속 노드면 새 단계 브랜치로 이동
              const parent = nodes.find((x) => x.id === n.parentId);
              if (parent?.kind === "branch") n.parentId = branchByStage[stage as Stage].id;
            }
          }
        }
      }
    } catch {
      failedSources.add("ai(호출 실패)");
    }
  }

  // ── S_intent 스코어링 (§9.2): 검색량 있으면 실공식, 없으면 등장빈도 프록시
  report("scoring", 94, "의도 가치 점수(S_intent) 산출 중…");
  const maxCpc = Math.max(...kwNodes.map((n) => n.cpc ?? 0), 1);
  const raw: number[] = kwNodes.map((n) => {
    const depthW = n.depth <= 2 ? 1.0 : n.depth === 3 ? 1.2 : 1.5;
    const riskPenalty = n.riskLevel === "red" ? 1.0 : n.riskLevel === "yellow" ? 0.5 : 0;
    if (volumeAvailable && (n.volumePc != null || n.volumeMo != null)) {
      const v = (n.volumePc ?? 0) + (n.volumeMo ?? 0);
      return 1.0 * Math.log(v + 1) + 0.8 * depthW + 0.6 * ((n.cpc ?? 0) / maxCpc) - 1.2 * riskPenalty;
    }
    const hits = hitCount.get(normKey(n.keyword)) || 1;
    return 1.0 * Math.log(hits + 1) + 0.8 * depthW - 1.2 * riskPenalty;
  });
  const min = Math.min(...raw, 0);
  const max = Math.max(...raw, 1);
  kwNodes.forEach((n, i) => {
    n.score = Math.round(((raw[i] - min) / (max - min || 1)) * 100);
  });

  report("done", 100, `완료 — 노드 ${nodes.length - 5}개 생성`);
  return { nodes, failedSources: Array.from(failedSources) };
}
