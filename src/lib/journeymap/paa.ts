// PAA(환자 질문) 트리 공용 타입 + JNode Project 변환기 — journeymap 단독판에서 이식.
// 서버(route)와 클라이언트가 함께 쓰는 순수 모듈 — 브라우저 전용 API 사용 금지.

import { scanRisk } from "./risk";
import { JNode, Project, Stage } from "./types";

export interface PaaQuestion {
  text: string;
  isLocal: boolean; // 지역 의존 질문 여부 (지역→플레이스·랜딩 / 일반→블로그)
}

export interface PaaCategory {
  name: string;
  stage: Stage; // AI 가 배정한 여정 단계 → 기존 지도 색·필터 그대로 작동
  questions: PaaQuestion[];
}

export interface PaaTree {
  name: string; // 메인 키워드
  categories: PaaCategory[];
  expanded?: string[]; // 질문 부족으로 확장 수집한 상위 지역 키워드들
}

export interface PaaDiff {
  added: string[];
  removed: string[];
}

export interface SnapshotSummary {
  id: string;
  query: string;
  region: string | null;
  topic: string | null;
  advertiser: string | null;
  rawCount: number;
  createdAt: string;
}

export interface AnalyzeResponse {
  source: "cache" | "fresh";
  snapshotId: string;
  createdAt: string;
  query: string;
  region: string | null;
  topic: string | null;
  rawCount: number;
  tree: PaaTree;
  diff: PaaDiff | null;
}

function pid(prefix: string, i: number, j = -1): string {
  return j >= 0 ? `paa_${prefix}_${i}_${j}` : `paa_${prefix}_${i}`;
}

/** 스냅샷 트리를 기존 /journeymap/map/[id] 화면이 그대로 렌더링하는 Project 로 변환한다. */
export function treeToProject(
  res: Pick<AnalyzeResponse, "query" | "region" | "topic" | "tree" | "createdAt"> & {
    advertiser?: string | null;
  },
  projectId: string
): Project {
  const nodes: JNode[] = [];
  const centerId = "paa_center";

  const base = {
    stageConfidence: 1,
    stageOverridden: false,
    riskLevel: "none" as const,
    riskReasons: [],
    isBrand: false,
    collapsed: false,
  };

  nodes.push({
    ...base,
    id: centerId,
    parentId: null,
    keyword: res.tree.name || res.query,
    kind: "center",
    depth: 0,
    stage: null,
    source: "seed",
    score: 100,
  });

  res.tree.categories.forEach((cat, i) => {
    const branchId = pid("b", i);
    nodes.push({
      ...base,
      id: branchId,
      parentId: centerId,
      keyword: cat.name,
      kind: "branch",
      depth: 1,
      stage: cat.stage,
      source: "seed",
      score: 80,
    });

    cat.questions.forEach((q, j) => {
      const risk = scanRisk(q.text);
      nodes.push({
        ...base,
        id: pid("q", i, j),
        parentId: branchId,
        keyword: q.text,
        kind: "keyword",
        depth: 2,
        stage: cat.stage,
        source: "naver_kin",
        score: q.isLocal ? 70 : 55, // 지역 질문은 전환 의도가 높아 가중
        riskLevel: risk.level,
        riskReasons: risk.reasons,
        isLocal: q.isLocal,
      });
    });
  });

  const now = Date.now();
  return {
    id: projectId,
    mainKeyword: res.query,
    profile: {
      name: res.advertiser || "환자 질문 분석",
      departments: [],
      regionSigungu: res.region ?? "",
      regionDong: "",
      mainTreatments: res.topic ? [res.topic] : [],
      targetAge: "",
      targetGender: "",
      competitors: [],
    },
    seeds: [],
    options: { sources: ["kin"], depth: 2, maxNodes: 200, useAi: false },
    status: "done",
    nodes,
    createdAt: now,
    updatedAt: now,
    sourceNote: `지식iN 질문 스냅샷 (${new Date(res.createdAt).toLocaleDateString("ko-KR")} 수집)`,
  };
}

/** 두 트리의 질문 텍스트를 비교해 새로 등장/사라진 질문을 계산한다.
 *  AI 가 매번 문장을 다듬으며 생기는 띄어쓰기·문장부호 차이는 변화로 치지 않는다. */
export function diffTrees(prev: PaaTree, next: PaaTree): PaaDiff {
  const norm = (s: string) => s.toLowerCase().replace(/[\s?.!~,]/g, "");
  const textMap = (t: PaaTree) => {
    const m = new Map<string, string>();
    for (const c of t.categories) for (const q of c.questions) m.set(norm(q.text), q.text.trim());
    return m;
  };
  const prevMap = textMap(prev);
  const nextMap = textMap(next);
  const added: string[] = [];
  const removed: string[] = [];
  nextMap.forEach((v, k) => {
    if (!prevMap.has(k)) added.push(v);
  });
  prevMap.forEach((v, k) => {
    if (!nextMap.has(k)) removed.push(v);
  });
  return { added, removed };
}
