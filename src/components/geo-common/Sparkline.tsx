// GEO 공통 · 트렌드 스파크라인 — VolumePoint[] 시계열을 미니 SVG 라인으로.
// 서버 렌더(순수). 검색량 카드 옆 '관심 추세'를 압축 표시(리스닝마인드 검색량 변동 축소판).
import type { VolumePoint } from "@/server/geo-studio/providers/port";

export function Sparkline({ points, width = 120, height = 34 }: { points: VolumePoint[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const dx = width / (points.length - 1);
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const coords = points.map((p, i) => [i * dx, y(p.value)] as const);
  const d = coords.map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
  const area = `${d} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1];
  const up = vals[vals.length - 1] >= vals[0];
  const color = up ? "#059669" : "#e11d48";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="검색 트렌드 스파크라인" className="overflow-visible">
      <path d={area} fill={color} fillOpacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} />
    </svg>
  );
}
