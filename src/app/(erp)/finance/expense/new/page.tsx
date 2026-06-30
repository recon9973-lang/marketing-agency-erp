import { redirect } from "next/navigation";
import { ExpenseForm } from "@/components/finance/ExpenseForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

export default async function NewExpensePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const clients = await fetchClientsForUser(user);

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="정산/지출" title="지출 등록" description="회사 지출 내역을 등록합니다. 공통 지출은 거래처를 비워둡니다." />
      <div className="rounded-md border border-line bg-white p-6">
        <ExpenseForm clients={clients.map((client) => ({ id: client.id, name: client.name }))} />
      </div>
    </section>
  );
}
