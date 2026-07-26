import dagre from "dagre";
import { JNode } from "./types";

export interface LaidOutNode extends JNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function nodeSize(n: JNode): { width: number; height: number } {
  if (n.kind === "center") return { width: 220, height: 64 };
  if (n.kind === "branch") return { width: 150, height: 48 };
  // 점수 비례 3단계 S/M/L
  const base = n.score >= 70 ? 200 : n.score >= 40 ? 176 : 152;
  return { width: Math.max(base, Math.min(260, n.keyword.length * 11 + 60)), height: 42 };
}

export function layoutTree(nodes: JNode[]): LaidOutNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 14, ranksep: 90, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const visible = visibleNodes(nodes);
  for (const n of visible) {
    const { width, height } = nodeSize(n);
    g.setNode(n.id, { width, height });
  }
  for (const n of visible) {
    if (n.parentId && visible.some((v) => v.id === n.parentId)) {
      g.setEdge(n.parentId, n.id);
    }
  }
  dagre.layout(g);

  return visible.map((n) => {
    const pos = g.node(n.id);
    const { width, height } = nodeSize(n);
    return {
      ...n,
      x: n.position?.x ?? pos.x - width / 2,
      y: n.position?.y ?? pos.y - height / 2,
      width,
      height,
    };
  });
}

// 접힌 브랜치 하위 노드 제외
export function visibleNodes(nodes: JNode[]): JNode[] {
  const byParent = new Map<string | null, JNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) || [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }
  const out: JNode[] = [];
  const walk = (n: JNode) => {
    out.push(n);
    if (n.collapsed) return;
    for (const c of byParent.get(n.id) || []) walk(c);
  };
  const roots = nodes.filter((n) => n.parentId === null);
  roots.forEach(walk);
  return out;
}

export function countDescendants(nodes: JNode[], id: string): number {
  const byParent = new Map<string | null, JNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) || [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }
  let count = 0;
  const walk = (nid: string) => {
    for (const c of byParent.get(nid) || []) {
      count++;
      walk(c.id);
    }
  };
  walk(id);
  return count;
}
