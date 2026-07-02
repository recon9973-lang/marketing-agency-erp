import { redirect } from "next/navigation";
import { BillingForm } from "@/components/finance/BillingForm";
import { PaymentForm } from "@/components/finance/PaymentForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { canAccessClient } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { updateBillingRecordAction } from "@/server/actions/finance";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { getBillingAccessInfo, getBillingDetail } from "@/server/repositories/finance";
import { loadAccessScopes } from "@/server/scope";
import { getCurrentUser } from "@/server/session";

export default async function EditBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
    redirect("/finance");
  }

  const { id } = await params;
  const [detail, accessInfo] = await Promise.all([getBillingDetail(id), getBillingAccessInfo(id)]);

  if (!detail || !accessInfo) {
    redirect("/finance");
  }

  const scopes = await loadAccessScopes(user);
  if (!canAccessClient(user, accessInfo.clientId, scopes, accessInfo.clientAssignedMarketerId)) {
    redirect("/finance");
  }

  const clients = await fetchClientsForUser(user);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="정산/지출" title="청구 수정" description="청구 내역을 수정하고 입금을 기록합니다." />

      <div className="rounded-md border border-line bg-white p-6">
        <BillingForm
          action={updateBillingRecordAction}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          initialValue={detail}
          submitLabel="저장"
        />
      </div>

      <div className="rounded-md border border-line bg-white p-6">
        <PaymentForm billingRecordId={detail.id} />
      </div>
    </section>
  );
}
