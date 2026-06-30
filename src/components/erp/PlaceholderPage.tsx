import { PageHeader } from "@/components/ui/PageHeader";

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
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <div className="rounded-md border border-line bg-white p-5 text-sm text-slate-500">다음 작업에서 실제 기능과 데이터가 연결됩니다.</div>
    </section>
  );
}
