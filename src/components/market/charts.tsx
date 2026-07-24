"use client";
/**
 * 상권분석 시각화 — 의존성 없는 순수 SVG 차트(도넛·반경 지도·스파크라인·연령바).
 * 기존 GEO 컴포넌트 스타일에 맞춘 경량 커스텀 차트.
 */

// 종별 색상(반경 지도·범례 공용).
export const TYPE_COLOR: Record<string, string> = {
  의원: "#10b981",
  치과의원: "#0ea5e9",
  한의원: "#f59e0b",
  병원: "#8b5cf6",
  종합병원: "#f43f5e",
  상급종합: "#e11d48",
  요양병원: "#64748b",
  한방병원: "#d97706",
  치과병원: "#0284c7",
  정신병원: "#a855f7"
};
export function colorOfType(t: string): string {
  return TYPE_COLOR[t] ?? "#94a3b8";
}

// ── 도넛 ─────────────────────────────────────────────────────
export function Donut({
  segments,
  size = 132,
  thickness = 20,
  centerLabel,
  centerSub
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((s, i) => {
            const len = (s.value / total) * circ;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        {centerLabel && (
          <text x="50%" y="47%" textAnchor="middle" className="fill-ink text-lg font-bold" style={{ fontSize: 20, fontWeight: 700 }}>
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text x="50%" y="62%" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
            {centerSub}
          </text>
        )}
      </svg>
      <ul className="min-w-0 space-y-0.5 text-[11px]">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="truncate text-slate-600 dark:text-slate-300">{s.label}</span>
            <span className="ml-auto shrink-0 font-semibold text-ink">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── 반경 지도(산점도) ────────────────────────────────────────
export function RadiusMap({
  center,
  points,
  radiusKm,
  highlightType,
  size = 300
}: {
  center: { lat: number; lng: number };
  points: { lat: number; lng: number; type: string }[];
  radiusKm: number;
  highlightType?: string;
  size?: number;
}) {
  const mid = size / 2;
  const pxPerKm = (size * 0.44) / radiusKm;
  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const proj = (p: { lat: number; lng: number }) => {
    const dxKm = (p.lng - center.lng) * 111 * cosLat;
    const dyKm = (p.lat - center.lat) * 111;
    return { x: mid + dxKm * pxPerKm, y: mid - dyKm * pxPerKm };
  };
  const rings = [radiusKm, radiusKm / 2].map((km) => km * pxPerKm);
  const types = Array.from(new Set(points.map((p) => p.type))).slice(0, 8);
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} className="rounded-xl border border-line bg-surface/40" style={{ maxWidth: size }}>
        {rings.map((rr, i) => (
          <circle key={i} cx={mid} cy={mid} r={rr} fill="none" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
        ))}
        <line x1={mid} y1={4} x2={mid} y2={size - 4} stroke="#e2e8f0" strokeWidth={0.5} />
        <line x1={4} y1={mid} x2={size - 4} y2={mid} stroke="#e2e8f0" strokeWidth={0.5} />
        {points.map((p, i) => {
          const { x, y } = proj(p);
          const hot = highlightType && p.type === highlightType;
          return <circle key={i} cx={x} cy={y} r={hot ? 3.2 : 2.4} fill={colorOfType(p.type)} opacity={hot ? 0.95 : 0.6} />;
        })}
        {/* 중심(대상 업체) */}
        <circle cx={mid} cy={mid} r={5.5} fill="#0f172a" stroke="#fff" strokeWidth={1.5} />
        <text x={mid} y={mid - 9} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700 }} className="fill-ink">
          기준
        </text>
        <text x={mid + rings[0] - 2} y={mid - 3} textAnchor="end" style={{ fontSize: 9 }} className="fill-slate-400">
          {radiusKm}km
        </text>
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
        {types.map((t) => (
          <span key={t} className="flex items-center gap-1 text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: colorOfType(t) }} />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 스파크라인(3~N점 추이) ──────────────────────────────────
export function Sparkline({ values, color = "#0ea5e9", width = 68, height = 22 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return null;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  const step = width / (clean.length - 1);
  const pts = clean.map((v, i) => `${i * step},${height - ((v - min) / span) * (height - 4) - 2}`).join(" ");
  const up = clean[clean.length - 1] >= clean[0];
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={pts} fill="none" stroke={up ? "#10b981" : "#f43f5e"} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── 가로 인구 피라미드(성별×연령) ───────────────────────────
export function GenderAgeBars({ bands }: { bands: { label: string; male: number; female: number }[] }) {
  const max = Math.max(1, ...bands.map((b) => Math.max(b.male, b.female)));
  return (
    <div className="space-y-1">
      {bands.map((b) => (
        <div key={b.label} className="flex items-center gap-1 text-[10px]">
          <div className="flex flex-1 justify-end">
            <div className="h-3 rounded-l bg-sky-500" style={{ width: `${(b.male / max) * 100}%` }} />
          </div>
          <span className="w-14 shrink-0 text-center text-slate-500">{b.label}</span>
          <div className="flex flex-1">
            <div className="h-3 rounded-r bg-rose-400" style={{ width: `${(b.female / max) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>◀ 남</span>
        <span>여 ▶</span>
      </div>
    </div>
  );
}
