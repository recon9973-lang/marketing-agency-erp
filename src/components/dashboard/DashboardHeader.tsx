// 대시보드 공통 헤더 — 오렌지 아이라인 · 제목 · 설명.
export function DashboardHeader({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-l-2 border-brand pl-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-strong">{eyebrow}</p>
      <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
