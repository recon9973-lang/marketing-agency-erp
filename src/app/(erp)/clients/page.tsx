import Link from "next/link";
import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { Role } from "@/domain/types";
import { ClientFavoriteButton } from "@/components/clients/ClientFavoriteButton";
import { fetchClientsForUser, type ClientListItem } from "@/server/repositories/clients";
import { listFavoriteClientIds } from "@/server/repositories/favorites";
import { getCurrentUser } from "@/server/session";

type ClientRow = ClientListItem & { favored: boolean };

const currencyFormatter = new Intl.NumberFormat("ko-KR");

function formatMoney(value: ClientListItem["monthlyContractFee"]) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${currencyFormatter.format(Number(value))}원`;
}

function buildColumns(canEdit: boolean): DataTableColumn<ClientRow>[] {
  const columns: DataTableColumn<ClientRow>[] = [
    {
      key: "favorite",
      header: "★",
      render: (client) => <ClientFavoriteButton clientId={client.id} favored={client.favored} />
    },
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

  columns.push({
    key: "actions",
    header: "관리",
    render: (client) => (
      <div className="flex items-center gap-3">
        <Link href={`/clients/${client.id}/ranks`} className="text-sm font-medium text-brand hover:underline">
          순위
        </Link>
        {canEdit ? (
          <Link href={`/clients/${client.id}/edit`} className="text-sm font-medium text-brand hover:underline">
            수정
          </Link>
        ) : null}
      </div>
    )
  });

  return columns;
}

export default async function ClientsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [clients, favoriteIds] = await Promise.all([
    fetchClientsForUser(user),
    listFavoriteClientIds(user.id)
  ]);
  const favoriteSet = new Set(favoriteIds);
  const rows: ClientRow[] = clients
    .map((client) => ({ ...client, favored: favoriteSet.has(client.id) }))
    .sort((a, b) => Number(b.favored) - Number(a.favored));
  const canCreate = user.role === Role.SUPER_ADMIN;
  const canEdit = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="거래처"
        title="거래처 운영 현황"
        description={
          user.role === Role.SUPER_ADMIN
            ? "전체 거래처와 담당자 배정, 최근 업무 및 정산 상태를 확인합니다."
            : "내 접근 범위에 포함된 거래처의 담당자, 업무, 정산 상태를 확인합니다."
        }
        actions={
          <>
            <div className="rounded-md border border-line bg-white px-4 py-3 text-sm text-slate-600">
              총 {clients.length}개 거래처
            </div>
            {canCreate ? (
              <Link
                href="/clients/new"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
              >
                새 거래처
              </Link>
            ) : null}
          </>
        }
      />

      <DataTable columns={buildColumns(canEdit)} rows={rows} emptyMessage="조회 가능한 거래처가 없습니다." />
    </section>
  );
}
