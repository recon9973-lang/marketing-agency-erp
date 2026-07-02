import { notFound, redirect } from "next/navigation";
import { ClientForm } from "@/components/clients/ClientForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Role } from "@/domain/types";
import { updateClientFormAction } from "@/server/actions/clients";
import { db } from "@/server/db";
import { fetchMarketerOptions } from "@/server/repositories/users";
import { getCurrentUser } from "@/server/session";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SUPER_ADMIN) {
    redirect("/clients");
  }

  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      businessNumber: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      contractStartDate: true,
      contractEndDate: true,
      monthlyContractFee: true,
      serviceNotes: true,
      assignedMarketerId: true,
      active: true
    }
  });

  if (!client) {
    notFound();
  }

  const marketers = await fetchMarketerOptions();
  const updateAction = updateClientFormAction.bind(null, client.id);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="거래처"
        title={`${client.name} 정보 수정`}
        description="거래처 기본 정보, 계약 조건, 담당자 배정, 운영 상태를 수정합니다."
      />

      <ClientForm
        action={updateAction}
        marketers={marketers}
        submitLabel="변경사항 저장"
        defaultValues={{
          name: client.name,
          code: client.code,
          businessNumber: client.businessNumber ?? undefined,
          contactName: client.contactName ?? undefined,
          contactEmail: client.contactEmail ?? undefined,
          contactPhone: client.contactPhone ?? undefined,
          contractStartDate: client.contractStartDate?.toISOString().slice(0, 10),
          contractEndDate: client.contractEndDate?.toISOString().slice(0, 10),
          monthlyContractFee: client.monthlyContractFee?.toString(),
          serviceNotes: client.serviceNotes ?? undefined,
          assignedMarketerId: client.assignedMarketerId ?? undefined,
          active: client.active
        }}
      />
    </section>
  );
}
