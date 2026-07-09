// 업무 칸반 보드 — 상태별 컬럼으로 업무를 시각화.
// 상태 전이는 도메인 규칙(transitionMap)이 엄격하므로 자유 드래그 대신
// 각 카드의 허용된 상태전이 버튼(WorkStatusButtons)으로 이동한다.
import { WorkStatus } from "@/domain/types";
import { workCategoryLabels, workStatusLabels } from "@/domain/work";
import type { WorkListItem } from "@/server/repositories/work";
import { WorkStatusButtons } from "@/components/work/WorkStatusButtons";
import { TimeLogButton } from "@/components/work/TimeLogButton";

const COLUMNS: WorkStatus[] = [
  WorkStatus.NOT_STARTED,
  WorkStatus.IN_PROGRESS,
  WorkStatus.WAITING,
  WorkStatus.REVIEW_NEEDED,
  WorkStatus.BLOCKED,
  WorkStatus.COMPLETED
];

const dateFmt = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });

function Card({ item }: { item: WorkListItem }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-ink">{item.title}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{workCategoryLabels[item.category]}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="font-medium text-slate-600">{item.clientName}</span>
        <span>· {item.ownerName}</span>
        {item.dueDate ? (
          <span className={item.delayed ? "font-semibold text-danger" : ""}>
            · {item.delayed ? "지연 " : "마감 "}
            {dateFmt.format(new Date(item.dueDate))}
          </span>
        ) : null}
      </div>
      <div className="mt-2">
        <TimeLogButton workId={item.id} loggedMinutes={item.loggedMinutes} estimatedMinutes={item.estimatedMinutes} />
      </div>
      <div className="mt-2 border-t border-line pt-2">
        <WorkStatusButtons workId={item.id} status={item.status} />
      </div>
    </div>
  );
}

export function WorkBoard({ items }: { items: WorkListItem[] }) {
  const byStatus = new Map<WorkStatus, WorkListItem[]>();
  for (const col of COLUMNS) byStatus.set(col, []);
  for (const item of items) {
    const bucket = byStatus.get(item.status);
    if (bucket) bucket.push(item);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {COLUMNS.map((col) => {
        const cards = byStatus.get(col) ?? [];
        return (
          <div key={col} className="rounded-xl border border-line bg-surface/50 p-2">
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-xs font-bold text-slate-600">{workStatusLabels[col]}</span>
              <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-500">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.length === 0 ? (
                <p className="px-1 py-4 text-center text-[11px] text-slate-400">비어 있음</p>
              ) : (
                cards.map((item) => <Card key={item.id} item={item} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
