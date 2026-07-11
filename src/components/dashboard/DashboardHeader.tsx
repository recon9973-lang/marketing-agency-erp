// 페이지 공통 헤더 — 랜딩(대시보드) 톤앤매너 통일: eyebrow(뮤트 대문자) · 제목 · 설명.
// PageHeader와 동일한 시각 언어. (기존 호출부 16개 그대로 유지)
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
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</p>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
