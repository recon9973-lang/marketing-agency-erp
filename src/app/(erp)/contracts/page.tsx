import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CreateContractForm } from "@/components/contracts/CreateContractForm";
import { fetchContractsForUser, type ContractListItem } from "@/server/repositories/contracts";
import { listClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

const won = new Intl.NumberFormat("ko-KR");
const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" });
function fmtDate(d: Date | null) {
  return d ? dateFmt.format(new Date(d)) : "-";
}

const columns: DataTableColumn<ContractListItem>[] = [
  {
    key: "title",
    header: "계약서",
    render: (c) => (
      <Link href={`/contracts/${c.id}` as Route} className="font-medium text-brand-strong hover:underline">
        {c.title}
      </Link>
    )
  },
  { key: "client", header: "거래처", render: (c) => c.clientName },
  { key: "amount", header: "금액", render: (c) => (c.amount ? `${won.format(Number(c.amount))}원` : "-") },
  { key: "period", header: "계약기간", render: (c) => <span className="text-xs text-slate-500">{fmtDate(c.startDate)} ~ {fmtDate(c.endDate)}</span> },
  {
    key: "status",
    header: "상태",
    render: (c) =>
      c.status === "SIGNED" ? (
        <span className="rounded-md bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">✓ 서명완료{c.signerName ? ` · ${c.signerName}` : ""}</span>
      ) : (
        <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-600">미서명</span>
      )
  },
  { key: "author", header: "작성자", render: (c) => c.authorName }
];

export default async function ContractsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [contracts, clients] = await Promise.all([fetchContractsForUser(user), listClientsForUser(user)]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="계약 관리"
        title="계약서"
        description="거래처별 계약서를 작성하고, 태블릿에서 서명(사인)까지 처리합니다. 서명 완료된 계약은 인쇄/PDF로 보관하세요."
      />
      <CreateContractForm clients={clients} />
      <DataTable columns={columns} rows={contracts} emptyMessage="등록된 계약서가 없습니다. ‘+ 새 계약서’로 시작하세요." />
    </div>
  );
}
