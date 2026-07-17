import { notFound, redirect } from "next/navigation";
import { ClientDetail } from "@/components/clients/ClientDetail";
import { Role } from "@/domain/types";
import { getClientDetail } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const detail = await getClientDetail(user, id);
  if (!detail) {
    notFound();
  }

  const canViewFinance = user.role !== Role.MARKETER;

  return (
    <div className="space-y-6 p-6">
      <a href="/clients" className="text-sm text-brand underline">← 거래처 목록</a>
      <ClientDetail
        client={detail.client}
        channels={detail.channels}
        works={detail.works}
        billings={detail.billings}
        canViewFinance={canViewFinance}
      />
    </div>
  );
}
