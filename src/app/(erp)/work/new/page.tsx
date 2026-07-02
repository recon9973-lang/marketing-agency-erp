import { redirect } from "next/navigation";
import { WorkForm } from "@/components/work/WorkForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { workCategoryLabels } from "@/domain/work";
import { Role, WorkCategory } from "@/domain/types";
import { createWorkItemFormAction } from "@/server/actions/work";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { fetchMarketerOptions } from "@/server/repositories/users";
import { getCurrentUser } from "@/server/session";

const categories = Object.values(WorkCategory).map((category) => ({
  value: category,
  label: workCategoryLabels[category]
}));

export default async function NewWorkPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const clients = await fetchClientsForUser(user);
  const owners =
    user.role === Role.MARKETER ? [{ id: user.id, name: user.name }] : await fetchMarketerOptions();

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="업무관리"
        title="신규 업무 등록"
        description="거래처와 담당자를 지정하고 업무 내용, 우선순위, 마감일을 입력합니다."
      />

      <WorkForm
        action={createWorkItemFormAction}
        clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        owners={owners}
        categories={categories}
        submitLabel="업무 등록"
        defaultValues={user.role === Role.MARKETER ? { ownerId: user.id } : undefined}
      />
    </section>
  );
}
