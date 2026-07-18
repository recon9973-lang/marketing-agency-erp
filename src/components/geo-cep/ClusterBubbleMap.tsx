// GEO CEP · 인텐트 클러스터 버블맵 — M2 CEP를 리스닝마인드 스타일 버블로 렌더.
// 색=인텐트 그룹(상황 태그), 크기=클러스터 규모, 점선링=화이트스페이스(선점 기회).
// 서버 컴포넌트(순수): 배치를 서버에서 계산해 SVG만 출력(클라이언트 JS 없음).

export type BubbleCep = {
  cep_text: string;
  situation_tag?: string;
  priority_score?: number;
  ai_mention_count?: number;
  is_whitespace?: boolean;
  member_texts?: string[];
};

const PALETTE = [
  { fill: "#34d399", ring: "#059669", text: "#065f46" }, // emerald
  { fill: "#38bdf8", ring: "#0284c7", text: "#075985" }, // sky
  { fill: "#a78bfa", ring: "#7c3aed", text: "#5b21b6" }, // violet
  { fill: "#fbbf24", ring: "#d97706", text: "#92400e" }, // amber
  { fill: "#fb7185", ring: "#e11d48", text: "#9f1239" }, // rose
  { fill: "#2dd4bf", ring: "#0d9488", text: "#115e59" }, // teal
  { fill: "#f472b6", ring: "#db2777", text: "#9d174d" }  // pink
];

const CX = 470;
const CY = 300;
const GROUP_R = 180; // 그룹 중심들이 놓이는 큰 원 반지름
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const trunc = (s: string, n = 14) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

type Node = { x: number; y: number; r: number; ci: number; cep: BubbleCep };

export function ClusterBubbleMap({ ceps, seedLabel }: { ceps: BubbleCep[]; seedLabel: string }) {
  const items = ceps.slice(0, 40);
  if (items.length === 0) return null;

  // 인텐트 그룹(상황 태그) → 색/중심.
  const groups = Array.from(new Set(items.map((c) => c.situation_tag || "기타")));
  const groupIndex = new Map(groups.map((g, i) => [g, i]));

  const sizeOf = (c: BubbleCep) => Math.max(1, c.member_texts?.length ?? 0, Math.round((c.priority_score ?? 0) / 20));
  const maxSize = Math.max(...items.map(sizeOf));
  const rScale = (s: number) => 12 + (s / maxSize) * 34;

  const perGroupCount = new Map<number, number>();
  const nodes: Node[] = items.map((cep) => {
    const gi = groupIndex.get(cep.situation_tag || "기타")!;
    const ang = groups.length > 1 ? (gi / groups.length) * 2 * Math.PI : 0;
    const gcx = groups.length > 1 ? CX + GROUP_R * Math.cos(ang) : CX;
    const gcy = groups.length > 1 ? CY + GROUP_R * Math.sin(ang) : CY;
    const k = perGroupCount.get(gi) ?? 0;
    perGroupCount.set(gi, k + 1);
    // 그룹 내부 골든앵글 스파이럴 배치.
    const sr = 26 * Math.sqrt(k);
    const sa = k * GOLDEN;
    return { x: gcx + sr * Math.cos(sa), y: gcy + sr * Math.sin(sa), r: rScale(sizeOf(cep)), ci: gi % PALETTE.length, cep };
  });

  // 뷰박스 자동 맞춤.
  const pad = 60;
  const minX = Math.min(...nodes.map((n) => n.x - n.r)) - pad;
  const maxX = Math.max(...nodes.map((n) => n.x + n.r)) + pad;
  const minY = Math.min(...nodes.map((n) => n.y - n.r)) - pad;
  const maxY = Math.max(...nodes.map((n) => n.y + n.r)) + pad;
  const w = maxX - minX;
  const h = maxY - minY;

  // 큰 버블부터 그려 작은 게 위에 오도록(라벨 가독).
  const draw = [...nodes].sort((a, b) => b.r - a.r);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card p-4">
      <p className="mb-1 text-sm font-bold text-ink">인텐트 클러스터 맵 — “{seedLabel}”</p>
      <p className="mb-3 text-[11px] text-slate-400">
        색=인텐트 그룹(상황) · 크기=클러스터 규모 · <span className="font-semibold text-blue-500">점선링</span>=화이트스페이스(선점 기회) · 진한 채움=자사 언급
      </p>
      <svg width={w} height={h} viewBox={`${minX} ${minY} ${w} ${h}`} role="img" aria-label={`${seedLabel} 인텐트 클러스터 버블맵`} className="max-w-none">
        {draw.map((n, i) => {
          const c = PALETTE[n.ci];
          const brand = (n.cep.ai_mention_count ?? 0) > 0;
          const white = n.cep.is_whitespace;
          return (
            <g key={i}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={c.fill}
                fillOpacity={brand ? 0.85 : 0.5}
                stroke={white ? "#3b82f6" : c.ring}
                strokeWidth={white ? 2 : 1.2}
                strokeDasharray={white ? "4 3" : undefined}
              />
              {n.r >= 20 && (
                <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize={10} fontWeight={600} fill={c.text}>
                  {trunc(n.cep.cep_text)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
