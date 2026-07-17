// GEO Studio · M2 CEP 파인더 — 임베딩 클러스터링 (원본 cluster.py 이식).
// 순수 파이썬 코사인 k-means(결정적 초기화) + centroid 중복제거. 외부 의존 없음.
import type { CepCandidate } from "./models";

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function cosine(a: number[], b: number[]): number {
  const na = Math.sqrt(dot(a, a)) || 1.0;
  const nb = Math.sqrt(dot(b, b)) || 1.0;
  return dot(a, b) / (na * nb);
}

function mean(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const acc = new Array<number>(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) acc[i] += v[i];
  return acc.map((x) => x / vectors.length);
}

export type Cluster = {
  members: CepCandidate[];
  vectors: number[][];
  centroid: number[];
};

/** 코사인 거리 k-means. 결정적(초기 centroid = 균등 간격 샘플). */
function kmeans(vectors: number[][], k: number, iters = 25): number[][] {
  const n = vectors.length;
  if (n === 0) return [];
  k = Math.max(1, Math.min(k, n));
  const step = Math.max(1, Math.floor(n / k));
  const centroids: number[][] = [];
  for (let i = 0; i < k; i++) centroids.push([...vectors[Math.min(i * step, n - 1)]]);

  const assignments = new Array<number>(n).fill(0);
  for (let it = 0; it < iters; it++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestSim = -2.0;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosine(vectors[i], centroids[c]);
        if (sim > bestSim) {
          best = c;
          bestSim = sim;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }
    for (let c = 0; c < k; c++) {
      const group: number[][] = [];
      for (let i = 0; i < n; i++) if (assignments[i] === c) group.push(vectors[i]);
      if (group.length) centroids[c] = mean(group);
    }
    if (!changed) break;
  }

  const groups: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) groups[assignments[i]].push(i);
  return groups.filter((g) => g.length > 0);
}

/** 후보+벡터를 클러스터로 묶는다. 빈 클러스터 제거. */
export function clusterCandidates(candidates: CepCandidate[], vectors: number[][], nClusters: number): Cluster[] {
  if (candidates.length === 0) return [];
  const groups = kmeans(vectors, nClusters);
  return groups.map((g) => {
    const members = g.map((i) => candidates[i]);
    const vecs = g.map((i) => vectors[i]);
    return { members, vectors: vecs, centroid: mean(vecs) };
  });
}

/** centroid 코사인 유사도가 threshold 이상인 클러스터를 병합. */
export function dedupClusters(clusters: Cluster[], threshold: number): Cluster[] {
  const merged: Cluster[] = [];
  // 멤버 수 내림차순(안정 정렬 — 동수는 원래 순서 유지)
  const ordered = clusters
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.members.length - a.c.members.length || a.i - b.i)
    .map((x) => x.c);
  for (const cl of ordered) {
    let dup: Cluster | null = null;
    for (const m of merged) {
      if (cosine(cl.centroid, m.centroid) >= threshold) {
        dup = m;
        break;
      }
    }
    if (dup === null) {
      merged.push({ members: [...cl.members], vectors: [...cl.vectors], centroid: cl.centroid });
    } else {
      dup.members.push(...cl.members);
      dup.vectors.push(...cl.vectors);
      dup.centroid = mean(dup.vectors);
    }
  }
  return merged;
}
