import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { workCategoryLabels, workStatusLabels } from "@/domain/work";
import { Role, WorkCategory, WorkStatus } from "@/domain/types";
import { fetchWorkItemsForUser, type WorkListFilters, type WorkListItem } from "@/server/repositories/work";
import { getCurrentUser } from "@/server/session";

type WorkPageSearchParams = {
  category?: string;
  status?: string;
  clientId?: string;
  ownerId?: string;
  dueDate?: string;
};

const categoryOptions = Object.values(WorkCategory);
const statusOptions = Object.values(WorkStatus);

function parseCategory(value?: string) {
  return categoryOptions.includes(value as WorkCategory) ? (value as WorkCategory) : undefined;
}

function parseStatus(value?: string) {
  return statusOptions.includes(value as WorkStatus) ? (value as WorkStatus) : undefined;
}

function normalizeTextFilter(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildFilters(searchParams: WorkPageSearchParams): WorkListFilters {
  return {
    category: parseCategory(searchParams.category),
    status: parseStatus(searchParams.status),
    clientId: normalizeTextFilter(searchParams.clientId),
    ownerId: normalizeTextFilter(searchParams.ownerId),
    dueDate: normalizeTextFilter(searchParams.dueDate)
  };
}

function formatDueDate(value: WorkListItem["dueDate"]) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function StatusBadge({ item }: { item: WorkListItem }) {
  const tone = item.delayed
    ? "border-danger/30 bg-danger/10 text-danger"
    : item.status === WorkStatus.COMPLETED
      ? "border-brand/30 bg-brand/10 text-brand"
      : "border-line bg-surface text-slate-700";

  return (
    <span className={`inline-flex min-w-20 justify-center rounded-md border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {item.delayed ? "지연" : workStatusLabels[item.status]}
    </span>
  );
}

const columns: DataTableColumn<WorkListItem>[] = [
  {
    key: "title",
    header: "업무",
    render: (item) => (
      <div>
        <p className="font-medium text-ink">{item.title}</p>
        <p className="mt-1 text-xs text-slate-500">{workCategoryLabels[item.category]}</p>
      </div>
    )
  },
  {
    key: "client",
    header: "거래처",
    render: (item) => item.clientName
  },
  {
    key: "owner",
    header: "담당자",
    render: (item) => item.ownerName
  },
  {
    key: "status",
    header: "상태",
    render: (item) => <StatusBadge item={item} />
  },
  {
    key: "due",
    header: "마감일",
    render: (item) => formatDueDate(item.dueDate)
  },
  {
    key: "notes",
    header: "진행 메모",
    render: (item) => <span className="line-clamp-2 text-slate-600">{item.progressNotes ?? "-"}</span>
  }
];

export default async function WorkPage({
  searchParams
}: {
  searchParams: Promise<WorkPageSearchParams>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const filters = buildFilters(resolvedSearchParams);
  const workItems = await fetchWorkItemsForUser(user, filters);
  const delayedCount = workItems.filter((item) => item.delayed).length;
  const reviewCount = workItems.filter((item) => item.status === WorkStatus.REVIEW_NEEDED).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">업무관리</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">거래처 업무 진행 현황</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            {user.role === Role.MARKETER
              ? "내가 담당하는 업무의 마감, 검수 요청, 진행 메모를 확인합니다."
              : "권한 범위 안의 거래처와 담당자별 업무 흐름을 확인하고 지시 우선순위를 잡습니다."}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">전체</p>
            <p className="mt-1 font-semibold text-ink">{workItems.length}</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">지연</p>
            <p className="mt-1 font-semibold text-danger">{delayedCount}</p>
          </div>
          <div className="rounded-md border border-line bg-white px-4 py-3">
            <p className="text-xs text-slate-500">검수</p>
            <p className="mt-1 font-semibold text-warning">{reviewCount}</p>
          </div>
        </div>
      </div>

      <form className="grid gap-3 rounded-md border border-line bg-white p-4 md:grid-cols-5">
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">카테고리</span>
          <select name="category" defaultValue={filters.category ?? ""} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink">
            <option value="">전체</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {workCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">상태</span>
          <select name="status" defaultValue={filters.status ?? ""} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink">
            <option value="">전체</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {workStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">거래처 ID</span>
          <input name="clientId" defaultValue={filters.clientId ?? ""} className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">담당자 ID</span>
          <input name="ownerId" defaultValue={filters.ownerId ?? ""} className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block text-xs font-semibold text-slate-500">마감일</span>
          <input type="date" name="dueDate" defaultValue={filters.dueDate ?? ""} className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <div className="flex items-end gap-2 md:col-span-5">
          <button type="submit" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
            필터 적용
          </button>
          <a href="/work" className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-slate-700">
            초기화
          </a>
        </div>
      </form>

      <DataTable columns={columns} rows={workItems} emptyMessage="조회 가능한 업무가 없습니다." />
    </section>
  );
}
