import { notFound, redirect } from "next/navigation";
import { Role } from "@/domain/types";
import { getContractDetail } from "@/server/repositories/contracts";
import { ContractDetailView } from "@/components/contracts/ContractDetailView";
import { getCurrentUser } from "@/server/session";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const contract = await getContractDetail(user, id);
  if (!contract) notFound();

  const canDelete = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN || contract.authorName === user.name;

  return (
    <div className="space-y-6">
      <a href="/contracts" className="text-sm font-semibold text-brand-strong hover:underline print:hidden">← 계약서 목록</a>
      <ContractDetailView contract={contract} canDelete={canDelete} />
    </div>
  );
}
