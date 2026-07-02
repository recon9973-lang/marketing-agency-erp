import { redirect } from "next/navigation";
import { ClientForm } from "@/components/clients/ClientForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { canAccessClient } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { updateClientAction } from "@/server/actions/clients";
import { fetchAssignableMarketers, getClientDetail } from "@/server/repositories/clients";
import { loadAccessScopes } from "@/server/scope";
import { getCurrentUser } from "@/server/session";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
    redirect("/clients");
  }

  const { id } = await params;
  const client = await getClientDetail(id);

  if (!client) {
    redirect("/clients");
  }

  const scopes = await loadAccessScopes(user);
  if (!canAccessClient(user, client.id, scopes, client.assignedMarketerId)) {
    redirect("/clients");
  }

  const marketers = await fetchAssignableMarketers();

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="거래처" title={`${client.name} 정보 수정`} description="거래처 기본 정보와 담당자, 계약 조건을 수정합니다." />
      <div className="rounded-md border border-line bg-white p-6">
        <ClientForm action={updateClientAction} marketers={marketers} initialValue={client} submitLabel="저장" />
      </div>
    </section>
  );
}
