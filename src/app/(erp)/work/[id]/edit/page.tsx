import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkForm } from "@/components/work/WorkForm";
import { WorkStatusButtons } from "@/components/work/WorkStatusButtons";
import { nextWorkStatus, workCategoryLabels, workStatusLabels, type WorkStatusAction } from "@/domain/work";
import { Role, WorkCategory, WorkStatus } from "@/domain/types";
import { changeWorkStatus, updateWorkItemFormAction } from "@/server/actions/work";
import { requireWorkAccess } from "@/server/authorization";
import { db } from "@/server/db";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { fetchMarketerOptions } from "@/server/repositories/users";
import { getCurrentUser } from "@/server/session";

const categories = Object.values(WorkCategory).map((category) => ({
  value: category,
  label: workCategoryLabels[category]
}));

const statusActionLabels: Record<WorkStatusAction, string> = {
  start: "시작",
  submit_for_review: "검수 요청",
  approve: "승인 완료",
  block: "차단",
  resume: "재개"
};

function availableStatusActions(status: WorkStatus, role: Role) {
  return (Object.keys(statusActionLabels) as WorkStatusAction[])
    .filter((action) => nextWorkStatus(status, action) !== status)
    .filter((action) => action !== "approve" || role !== Role.MARKETER)
    .map((action) => ({ action, label: statusActionLabels[action] }));
}

export default async function EditWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const workItem = await db.workItem.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      clientId: true,
      ownerId: true,
      category: true,
      status: true,
      priority: true,
      dueDate: true,
      progressNotes: true
    }
  });

  if (!workItem) {
    notFound();
  }

  try {
    await requireWorkAccess(user, { clientId: workItem.clientId, ownerId: workItem.ownerId });
  } catch {
    redirect("/work");
  }

  const clients = await fetchClientsForUser(user);
  const owners =
    user.role === Role.MARKETER ? [{ id: user.id, name: user.name }] : await fetchMarketerOptions();
  const updateAction = updateWorkItemFormAction.bind(null, workItem.id);
  const statusOptions = availableStatusActions(workItem.status, user.role);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="업무관리"
        title={`${workItem.title} 수정`}
        description="업무 내용과 담당 정보를 수정하고 상태를 변경합니다."
        actions={<StatusBadge className="min-w-20">{workStatusLabels[workItem.status]}</StatusBadge>}
      />

      <div className="rounded-md border border-line bg-white p-4">
        <p className="mb-2 text-xs font-semibold text-slate-500">상태 변경</p>
        <WorkStatusButtons workItemId={workItem.id} options={statusOptions} changeStatus={changeWorkStatus} />
        {statusOptions.length === 0 ? <p className="text-sm text-slate-500">변경 가능한 상태가 없습니다.</p> : null}
      </div>

      <WorkForm
        action={updateAction}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        owners={owners}
        categories={categories}
        submitLabel="변경사항 저장"
        defaultValues={{
          title: workItem.title,
          clientId: workItem.clientId,
          ownerId: workItem.ownerId,
          category: workItem.category,
          priority: String(workItem.priority),
          dueDate: workItem.dueDate?.toISOString().slice(0, 10),
          progressNotes: workItem.progressNotes ?? undefined
        }}
      />
    </section>
  );
}
