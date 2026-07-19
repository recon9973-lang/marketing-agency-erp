// A1 — GEO Score / SEO Score 듀얼 게이지(연결·분리). 인라인 SVG 반원 게이지.
// GEO=AI 언급률(성과), SEO=월보장 유지율·홈피(토대). 같은 콘텐츠가 양쪽에 기여함을 연결선으로 표현.

function Gauge({ value, color, size = 132 }: { value: number; color: string; size?: number }) {
  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h;
  const r = size * 0.44;
  const sw = size * 0.11;
  const a0 = Math.PI;
  const frac = Math.max(0, Math.min(1, value / 100));
  const a1 = Math.PI * (1 - frac);
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const xe = cx + r * Math.cos(Math.PI * 0);
  const ye = cy + r * Math.sin(Math.PI * 0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={`점수 ${value}`}>
      <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${xe} ${ye}`} fill="none" stroke="#e9ddd2" strokeWidth={sw} strokeLinecap="round" />
      <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size * 0.22} fontWeight={800} fill={color} fontFamily="ui-monospace, monospace">
        {value}
      </text>
    </svg>
  );
}

export function ScorePair({
  geoScore,
  seoScore,
  geoNote,
  seoNote
}: {
  geoScore: number;
  seoScore: number | null;
  geoNote: string;
  seoNote: string;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4">
        <Gauge value={geoScore} color="#d9662e" />
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-brand">GEO Score</p>
          <p className="mt-0.5 text-3xl font-extrabold leading-none text-ink">
            {geoScore}
            <span className="text-base font-bold text-slate-400">/100</span>
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">{geoNote}</p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5 font-mono text-[10px] text-slate-400">
        <span>같은 콘텐츠</span>
        <span className="h-px w-10 bg-line md:h-10 md:w-px" />
        <span>토대 → 성과</span>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4">
        <Gauge value={seoScore ?? 0} color="#2f6fb0" />
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-sky-700">SEO Score</p>
          <p className="mt-0.5 text-3xl font-extrabold leading-none text-ink">
            {seoScore === null ? "—" : seoScore}
            <span className="text-base font-bold text-slate-400">/100</span>
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">{seoNote}</p>
        </div>
      </div>
    </div>
  );
}
