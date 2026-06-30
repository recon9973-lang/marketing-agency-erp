import { redirect } from "next/navigation";
import { WorkForm } from "@/components/work/WorkForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { createWorkItemAction } from "@/server/actions/work";
import { fetchAssignableMarketers, fetchClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

export default async function NewWorkPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [clients, marketers] = await Promise.all([fetchClientsForUser(user), fetchAssignableMarketers()]);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="업무관리" title="새 업무 등록" description="거래처와 담당자를 지정하고 업무 정보를 입력합니다." />
      <div className="rounded-md border border-line bg-white p-6">
        <WorkForm
          action={createWorkItemAction}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          marketers={marketers}
          submitLabel="등록"
        />
      </div>
    </section>
  );
}
