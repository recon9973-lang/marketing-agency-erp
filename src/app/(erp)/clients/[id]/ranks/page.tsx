import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlaceRankDeleteButton } from "@/components/place-rank/PlaceRankDeleteButton";
import { PlaceRankForm } from "@/components/place-rank/PlaceRankForm";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { FilterBar, FilterField } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { rankDelta } from "@/domain/place-rank";
import { requireClientAccess } from "@/server/authorization";
import { getClientAccessInfo, getClientDetail } from "@/server/repositories/clients";
import { listPlaceRankKeywords, listPlaceRanks, type PlaceRankListItem } from "@/server/repositories/place-rank";
import { getCurrentUser } from "@/server/session";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "UTC" });

type RankRow = PlaceRankListItem & { delta: number | null };

/** 키워드별로 직전 기록 대비 순위 변동을 계산해 붙인다. */
function withDeltas(records: PlaceRankListItem[]): RankRow[] {
  const byKeywordAsc = new Map<string, PlaceRankListItem[]>();

  for (const record of [...records].sort((a, b) => a.recordedOn.getTime() - b.recordedOn.getTime())) {
    const list = byKeywordAsc.get(record.keyword) ?? [];
    list.push(record);
    byKeywordAsc.set(record.keyword, list);
  }

  const deltas = new Map<string, number | null>();

  for (const list of byKeywordAsc.values()) {
    list.forEach((record, index) => {
      deltas.set(record.id, rankDelta(record.rank, index > 0 ? list[index - 1].rank : null));
    });
  }

  return records.map((record) => ({ ...record, delta: deltas.get(record.id) ?? null }));
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs font-semibold text-slate-400">신규</span>;
  }

  if (delta > 0) {
    return <span className="text-sm font-semibold text-brand">▲ {delta}</span>;
  }

  if (delta < 0) {
    return <span className="text-sm font-semibold text-danger">▼ {Math.abs(delta)}</span>;
  }

  return <span className="text-sm text-slate-400">–</span>;
}

const columns: DataTableColumn<RankRow>[] = [
  {
    key: "date",
    header: "날짜",
    render: (row) => dateFormatter.format(row.recordedOn)
  },
  {
    key: "keyword",
    header: "키워드",
    render: (row) => <span className="font-medium text-ink">{row.keyword}</span>
  },
  {
    key: "rank",
    header: "순위",
    render: (row) => <span className="text-base font-semibold text-ink">{row.rank}위</span>
  },
  {
    key: "delta",
    header: "변동",
    render: (row) => <DeltaBadge delta={row.delta} />
  },
  {
    key: "memo",
    header: "메모",
    render: (row) => row.memo ?? "-"
  },
  {
    key: "recorder",
    header: "기록자",
    render: (row) => row.createdByName ?? "-"
  },
  {
    key: "actions",
    header: "관리",
    render: (row) => <PlaceRankDeleteButton placeRankId={row.id} />
  }
];

export default async function ClientRanksPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ keyword?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const accessInfo = await getClientAccessInfo(id);

  if (!accessInfo) {
    notFound();
  }

  try {
    await requireClientAccess(user, id, { assignedMarketerId: accessInfo.assignedMarketerId });
  } catch {
    redirect("/clients");
  }

  const { keyword } = await searchParams;
  const [client, keywords, records] = await Promise.all([
    getClientDetail(id),
    listPlaceRankKeywords(id),
    listPlaceRanks(id, { keyword: keyword?.trim() || undefined })
  ]);

  const rows = withDeltas(records);
  const latestByKeyword = new Map<string, RankRow>();

  for (const row of [...rows].sort((a, b) => b.recordedOn.getTime() - a.recordedOn.getTime())) {
    if (!latestByKeyword.has(row.keyword)) {
      latestByKeyword.set(row.keyword, row);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="거래처 · 플레이스 순위"
        title={`${client?.name ?? "거래처"} 순위 관리`}
        description="네이버 플레이스 등 키워드별 노출 순위를 날짜별로 기록하고 변동 추이를 확인합니다."
        actions={
          <Link href="/clients" className="text-sm font-medium text-brand hover:underline">
            ← 거래처 목록
          </Link>
        }
      />

      {latestByKeyword.size > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...latestByKeyword.values()].slice(0, 8).map((row) => (
            <div key={row.keyword} className="rounded-md border border-line bg-white px-4 py-3">
              <p className="truncate text-xs text-slate-500">{row.keyword}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-xl font-semibold text-ink">{row.rank}위</p>
                <DeltaBadge delta={row.delta} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{dateFormatter.format(row.recordedOn)} 기준</p>
            </div>
          ))}
        </div>
      ) : null}

      <PlaceRankForm clientId={id} keywords={keywords} />

      {keywords.length > 0 ? (
        <form method="get">
          <FilterBar
            actions={
              <button
                type="submit"
                className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-surface"
              >
                적용
              </button>
            }
          >
            <FilterField label="키워드" className="md:w-64">
              <Select name="keyword" defaultValue={keyword ?? ""}>
                <option value="">전체 키워드</option>
                {keywords.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </FilterField>
          </FilterBar>
        </form>
      ) : null}

      <DataTable columns={columns} rows={rows} emptyMessage="아직 기록된 순위가 없습니다. 위에서 첫 순위를 기록해보세요." />
    </section>
  );
}
