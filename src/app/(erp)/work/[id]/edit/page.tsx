import { redirect } from "next/navigation";
import { WorkForm } from "@/components/work/WorkForm";
import { WorkStatusActions } from "@/components/work/WorkStatusActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { canAccessClient, canAccessMarketer } from "@/domain/access-control";
import { updateWorkItemAction } from "@/server/actions/work";
import { fetchAssignableMarketers, fetchClientsForUser } from "@/server/repositories/clients";
import { getWorkItemAccessInfo, getWorkItemDetail } from "@/server/repositories/work";
import { loadAccessScopes } from "@/server/scope";
import { getCurrentUser } from "@/server/session";

export default async function EditWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const [detail, accessInfo] = await Promise.all([getWorkItemDetail(id), getWorkItemAccessInfo(id)]);

  if (!detail || !accessInfo) {
    redirect("/work");
  }

  const scopes = await loadAccessScopes(user);
  const allowed =
    canAccessClient(user, accessInfo.clientId, scopes, accessInfo.clientAssignedMarketerId) &&
    canAccessMarketer(user, accessInfo.ownerId, scopes);

  if (!allowed) {
    redirect("/work");
  }

  const [clients, marketers] = await Promise.all([fetchClientsForUser(user), fetchAssignableMarketers()]);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="업무관리" title={`${detail.title} 수정`} description="업무 정보와 진행 상태를 관리합니다." />

      <div className="rounded-md border border-line bg-white p-6">
        <WorkStatusActions workItemId={detail.id} status={accessInfo.status} />
      </div>

      <div className="rounded-md border border-line bg-white p-6">
        <WorkForm
          action={updateWorkItemAction}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          marketers={marketers}
          initialValue={detail}
          submitLabel="저장"
        />
      </div>
    </section>
  );
}
