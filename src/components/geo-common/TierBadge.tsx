// GEO Studio · 데이터 티어 배지 — Charter §3·§7.
// 화면이 표시하는 값이 실측(네이버)인지 AI인지 근사인지 항상 명시(신뢰성 투명성).
import type { DataTier } from "@/server/geo-studio/providers/port";

const MAP: Record<DataTier, { label: string; cls: string; dot: string }> = {
  measured: { label: "실측", cls: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  ai: { label: "AI", cls: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  approx: { label: "근사", cls: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" }
};

export function TierBadge({ tier, note }: { tier: DataTier; note?: string }) {
  const m = MAP[tier];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${m.cls}`} title={note ?? `데이터 출처: ${m.label}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
      {note ? <span className="font-normal opacity-70">· {note}</span> : null}
    </span>
  );
}
