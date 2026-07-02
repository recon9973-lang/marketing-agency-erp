import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DateInput, Input, Select } from "@/components/ui/fields";
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

function WorkStatusBadge({ item }: { item: WorkListItem }) {
  const tone = item.delayed ? "danger" : item.status === WorkStatus.COMPLETED ? "success" : "neutral";

  return (
    <StatusBadge tone={tone} className="min-w-20">
      {item.delayed ? "지연" : workStatusLabels[item.status]}
    </StatusBadge>
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
    render: (item) => <WorkStatusBadge item={item} />
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
  },
  {
    key: "manage",
    header: "관리",
    render: (item) => (
      <a href={`/work/${item.id}/edit`} className="text-sm font-semibold text-brand hover:underline">
        수정
      </a>
    )
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
      <PageHeader
        eyebrow="업무관리"
        title="거래처 업무 진행 현황"
        description={
          user.role === Role.MARKETER
            ? "내가 담당하는 업무의 마감, 검수 요청, 진행 메모를 확인합니다."
            : "권한 범위 안의 거래처와 담당자별 업무 흐름을 확인하고 지시 우선순위를 잡습니다."
        }
        actions={
          <div className="flex items-center gap-2">
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
            <LinkButton href="/work/new" variant="primary">
              신규 업무
            </LinkButton>
          </div>
        }
      />

      <FilterBar columns={5} resetHref="/work">
        <FormField label="카테고리">
          <Select name="category" defaultValue={filters.category ?? ""}>
            <option value="">전체</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {workCategoryLabels[category]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="상태">
          <Select name="status" defaultValue={filters.status ?? ""}>
            <option value="">전체</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {workStatusLabels[status]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="거래처 ID">
          <Input name="clientId" defaultValue={filters.clientId ?? ""} />
        </FormField>
        <FormField label="담당자 ID">
          <Input name="ownerId" defaultValue={filters.ownerId ?? ""} />
        </FormField>
        <FormField label="마감일">
          <DateInput name="dueDate" defaultValue={filters.dueDate ?? ""} />
        </FormField>
      </FilterBar>

      <DataTable columns={columns} rows={workItems} emptyMessage="조회 가능한 업무가 없습니다." />
    </section>
  );
}
