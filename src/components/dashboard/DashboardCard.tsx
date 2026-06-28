import type { ReactNode } from "react";

export function DashboardCard({
  label,
  value,
  description
}: {
  label: string;
  value: ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-md border border-line bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-3 text-2xl font-semibold text-ink">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
