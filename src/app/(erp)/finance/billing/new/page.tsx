import { redirect } from "next/navigation";
import { BillingForm } from "@/components/finance/BillingForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Role } from "@/domain/types";
import { createBillingRecordAction } from "@/server/actions/finance";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

export default async function NewBillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
    redirect("/finance");
  }

  const clients = await fetchClientsForUser(user);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="정산/지출" title="청구 등록" description="거래처 월별 청구 내역을 등록합니다." />
      <div className="rounded-md border border-line bg-white p-6">
        <BillingForm
          action={createBillingRecordAction}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          submitLabel="등록"
        />
      </div>
    </section>
  );
}
