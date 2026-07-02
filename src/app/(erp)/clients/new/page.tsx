import { redirect } from "next/navigation";
import { ClientForm } from "@/components/clients/ClientForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Role } from "@/domain/types";
import { createClientFormAction } from "@/server/actions/clients";
import { fetchMarketerOptions } from "@/server/repositories/users";
import { getCurrentUser } from "@/server/session";

export default async function NewClientPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SUPER_ADMIN) {
    redirect("/clients");
  }

  const marketers = await fetchMarketerOptions();

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="거래처"
        title="신규 거래처 등록"
        description="거래처 기본 정보와 계약 조건을 입력하고 담당자를 배정합니다."
      />

      <ClientForm action={createClientFormAction} marketers={marketers} submitLabel="거래처 등록" />
    </section>
  );
}
