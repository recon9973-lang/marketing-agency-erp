// GEO 여정 그래프 — M4 여정 트리를 검색 경로 그래프(SVG)로 렌더.
// 리스닝마인드 패스파인더 스타일: 깊이=가로축, 분기=세로 확산, 주 경로는 굵은 라인 강조.
// 서버 컴포넌트(순수) — 레이아웃을 서버에서 계산해 SVG만 출력(클라이언트 JS 없음).

export type RawNode = {
  query: string;
  depth: number;
  brand_mentioned?: boolean;
  children?: RawNode[];
};

type Laid = { id: number; query: string; depth: number; brand: boolean; x: number; y: number; parent: number | null };

const COL = 210; // 깊이 1단계 가로 간격(px)
const ROW = 46; // 리프 1개 세로 간격(px)
const PAD_X = 90;
const PAD_Y = 34;
const R = 7;
const MAX_LEAVES = 26; // 과밀 방지

/** 트리 → 좌표 배치(틀:깊이=x, 리프순번=y, 내부노드=자식 y 평균). */
function layout(root: RawNode): { nodes: Laid[]; maxDepth: number; leaves: number } {
  const nodes: Laid[] = [];
  let leafY = 0;
  let maxDepth = 0;

  function dfs(n: RawNode, parent: number | null): number {
    const id = nodes.length;
    const node: Laid = { id, query: n.query, depth: n.depth, brand: Boolean(n.brand_mentioned), x: n.depth, y: 0, parent };
    nodes.push(node);
    maxDepth = Math.max(maxDepth, n.depth);
    const kids = (n.children ?? []).filter(() => leafY < MAX_LEAVES);
    if (kids.length === 0) {
      node.y = leafY++;
    } else {
      const ys = kids.map((c) => dfs(c, id));
      node.y = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    return node.y;
  }
  dfs(root, null);
  return { nodes, maxDepth, leaves: Math.max(1, leafY) };
}

const trunc = (s: string, n = 16) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function JourneyGraph({ tree, primaryPath, brand }: { tree: RawNode; primaryPath: string[]; brand: string }) {
  const { nodes, maxDepth, leaves } = layout(tree);
  const width = PAD_X * 2 + maxDepth * COL + 120;
  const height = PAD_Y * 2 + (leaves - 1) * ROW + 20;
  const px = (n: Laid) => PAD_X + n.x * COL;
  const py = (n: Laid) => PAD_Y + n.y * ROW;

  const onPath = new Set(primaryPath);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const edges = nodes
    .filter((n) => n.parent !== null)
    .map((n) => {
      const p = byId.get(n.parent!)!;
      const x1 = px(p) + R, y1 = py(p);
      const x2 = px(n) - R, y2 = py(n);
      const mx = (x1 + x2) / 2;
      const primary = onPath.has(n.query) && onPath.has(p.query);
      return { d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, primary, id: n.id };
    })
    .sort((a, b) => Number(a.primary) - Number(b.primary)); // 주 경로를 위에 그림

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card p-4">
      <p className="mb-1 text-sm font-bold text-ink">검색 경로 그래프 (여정 트리)</p>
      <p className="mb-3 text-[11px] text-slate-400">
        가로축=검색 깊이 · 굵은 <span className="font-semibold text-rose-500">붉은 경로</span>=주 여정 · <span className="font-semibold text-emerald-600">초록 노드</span>=브랜드 언급 · 회색=미언급(갭)
      </p>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${brand} 검색 여정 경로 그래프`} className="max-w-none">
        {edges.map((e) => (
          <path
            key={e.id}
            d={e.d}
            fill="none"
            stroke={e.primary ? "#e11d48" : "#cbd5e1"}
            strokeWidth={e.primary ? 3 : 1}
            strokeOpacity={e.primary ? 0.95 : 0.5}
          />
        ))}
        {nodes.map((n) => {
          const cx = px(n), cy = py(n);
          const isPath = onPath.has(n.query);
          const fill = n.brand ? "#059669" : isPath ? "#e11d48" : "#ffffff";
          const stroke = n.brand ? "#047857" : isPath ? "#e11d48" : "#94a3b8";
          return (
            <g key={n.id}>
              <circle cx={cx} cy={cy} r={R} fill={fill} stroke={stroke} strokeWidth={1.5} />
              <text x={cx + R + 4} y={cy + 3.5} fontSize={11} fill={n.brand ? "#065f46" : "#334155"} fontWeight={isPath || n.brand ? 600 : 400}>
                {trunc(n.query)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
