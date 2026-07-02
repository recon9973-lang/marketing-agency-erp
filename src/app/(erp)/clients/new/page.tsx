import { redirect } from "next/navigation";
import { ClientForm } from "@/components/clients/ClientForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Role } from "@/domain/types";
import { createClientAction } from "@/server/actions/clients";
import { fetchAssignableMarketers } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

export default async function NewClientPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== Role.SUPER_ADMIN) {
    redirect("/clients");
  }

  const marketers = await fetchAssignableMarketers();

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="거래처" title="새 거래처 등록" description="거래처 기본 정보와 담당자, 계약 조건을 입력합니다." />
      <div className="rounded-md border border-line bg-white p-6">
        <ClientForm action={createClientAction} marketers={marketers} submitLabel="등록" />
      </div>
    </section>
  );
}
