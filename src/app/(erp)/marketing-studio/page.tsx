import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/session";
import { StudioClient } from "./StudioClient";

export default async function StudioPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // 담당자는 배정 거래처만, 관리자 이상은 활성 거래처 전체(실제 접근권한은 각 액션에서 재확인).
  const clients = await db.client.findMany({
    where: { active: true, ...(user.role === Role.MARKETER ? { assignedMarketerId: user.id } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  return (
    <section className="space-y-6">
      <DashboardHeader
        eyebrow="마케팅 스튜디오"
        title="VENOM Marketing Engine"
        description="거래처 마케팅 업무를 리서치 → 콘텐츠 생성 → 의료광고법 검수 → 성과수집 → 리포트로 실행합니다. 외부 API 키가 설정되지 않은 기능은 결과에 안내(CONFIG_MISSING)가 표시됩니다."
      />
      <StudioClient clients={clients} />
    </section>
  );
}
