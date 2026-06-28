export function PlaceholderPage({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-brand">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      </div>

      <div className="rounded-md border border-line bg-white p-5 text-sm text-slate-500">다음 작업에서 실제 기능과 데이터가 연결됩니다.</div>
    </section>
  );
}
