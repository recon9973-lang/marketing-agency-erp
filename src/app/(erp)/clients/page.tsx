import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { Role } from "@/domain/types";
import { fetchClientsForUser, type ClientListItem } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

const currencyFormatter = new Intl.NumberFormat("ko-KR");

function formatMoney(value: ClientListItem["monthlyContractFee"]) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${currencyFormatter.format(Number(value))}원`;
}

const columns: DataTableColumn<ClientListItem>[] = [
  {
    key: "name",
    header: "거래처",
    render: (client) => (
      <div>
        <p className="font-medium text-ink">{client.name}</p>
        <p className="mt-1 text-xs text-slate-500">{client.active ? "운영중" : "중지"}</p>
      </div>
    )
  },
  {
    key: "marketer",
    header: "담당자",
    render: (client) => client.assignedMarketerName ?? "미배정"
  },
  {
    key: "contract",
    header: "월 계약금",
    render: (client) => formatMoney(client.monthlyContractFee)
  },
  {
    key: "work",
    header: "최근 업무",
    render: (client) => client.latestWorkStatus ?? "-"
  },
  {
    key: "billing",
    header: "최근 정산",
    render: (client) => client.latestBillingStatus ?? "-"
  }
];

export default async function ClientsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const clients = await fetchClientsForUser(user);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">거래처</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">거래처 운영 현황</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            {user.role === Role.SUPER_ADMIN
              ? "전체 거래처와 담당자 배정, 최근 업무 및 정산 상태를 확인합니다."
              : "내 접근 범위에 포함된 거래처의 담당자, 업무, 정산 상태를 확인합니다."}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white px-4 py-3 text-sm text-slate-600">총 {clients.length}개 거래처</div>
      </div>

      <DataTable columns={columns} rows={clients} emptyMessage="조회 가능한 거래처가 없습니다." />
    </section>
  );
}
