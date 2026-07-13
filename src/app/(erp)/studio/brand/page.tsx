import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { BrandKitManager } from "@/components/studio/BrandKitManager";
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { getDefaultOrgId } from "@/server/org";
import { listBrandKits } from "@/server/repositories/brand-kits";

export const dynamic = "force-dynamic";
export const metadata = { title: "브랜드킷" };

export default async function BrandKitPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) redirect("/studio");

  const orgId = await getDefaultOrgId();
  const [kits, clients] = await Promise.all([
    listBrandKits(orgId),
    db.client.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 })
  ]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="디자인 · 브랜드"
        title="브랜드킷"
        description="거래처별 로고·컬러·폰트를 저장해 디자인 스튜디오에서 원클릭으로 브랜드 톤을 맞춥니다. 거래처를 지정하면 그 거래처 디자인에 우선 적용됩니다."
      />
      <BrandKitManager initialKits={kits} clients={clients} />
    </div>
  );
}
