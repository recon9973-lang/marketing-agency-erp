import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type CardTone = "brand" | "rose" | "amber" | "green" | "slate";

const TONE: Record<CardTone, { dot: string; iconBg: string; iconText: string }> = {
  brand: { dot: "bg-brand", iconBg: "bg-brand-soft", iconText: "text-brand-strong" },
  rose: { dot: "bg-rose-500", iconBg: "bg-rose-50", iconText: "text-rose-600" },
  amber: { dot: "bg-amber-500", iconBg: "bg-amber-50", iconText: "text-amber-600" },
  green: { dot: "bg-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  slate: { dot: "bg-slate-400", iconBg: "bg-slate-100", iconText: "text-slate-600" }
};

export function DashboardCard({
  label,
  value,
  description,
  tone = "slate",
  icon: Icon
}: {
  label: string;
  value: ReactNode;
  description?: string;
  tone?: CardTone;
  icon?: LucideIcon;
}) {
  const t = TONE[tone] ?? TONE.slate;
  return (
    <div className="rounded-xl border border-line bg-white p-5 transition hover:shadow-sm">
      <div className="flex items-start justify-between">
        <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className={`h-2 w-2 rounded-full ${t.dot}`} />
          {label}
        </p>
        {Icon ? (
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.iconBg} ${t.iconText}`}>
            <Icon className="h-4 w-4" strokeWidth={1.9} />
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-[26px] font-bold leading-none tracking-tight text-ink">{value}</div>
      {description ? <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p> : null}
    </div>
  );
}
