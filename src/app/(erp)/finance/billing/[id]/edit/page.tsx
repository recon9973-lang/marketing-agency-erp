import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BillingForm } from "@/components/finance/BillingForm";
import { BillingPayLink } from "@/components/finance/BillingPayLink";
import { PaymentForm } from "@/components/finance/PaymentForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { canAccessClient } from "@/domain/access-control";
import { Role } from "@/domain/types";
import { updateBillingRecordAction } from "@/server/actions/finance";
import { tossConfigured } from "@/server/integrations/toss";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { getBillingAccessInfo, getBillingDetail } from "@/server/repositories/finance";
import { loadAccessScopes } from "@/server/scope";
import { getCurrentUser } from "@/server/session";

/** 요청 헤더/환경변수로 절대 URL의 origin을 만든다. */
async function resolveOrigin() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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

  const [clients, origin] = await Promise.all([fetchClientsForUser(user), resolveOrigin()]);
  const payUrl = `${origin}/pay/${detail.id}`;

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
        <BillingPayLink url={payUrl} configured={tossConfigured()} />
      </div>

      <div className="rounded-md border border-line bg-white p-6">
        <PaymentForm billingRecordId={detail.id} />
      </div>
    </section>
  );
}
