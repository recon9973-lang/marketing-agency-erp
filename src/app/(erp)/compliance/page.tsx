import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MedicalLawChecker } from "@/components/compliance/MedicalLawChecker";
import { listClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const clients = await listClientsForUser(user);

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="컴플라이언스"
        title="의료법 검수"
        description="원고·광고 카피를 붙여넣으면 의료광고법(제56조) 위험 표현을 규칙엔진으로 1차 표시합니다. 최종 승인은 사람이 합니다."
      />
      <div className="rounded-2xl border border-line bg-white p-5">
        <MedicalLawChecker clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </div>
    </div>
  );
}
