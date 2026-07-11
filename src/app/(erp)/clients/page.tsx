// 목표 경로: src/app/(erp)/clients/page.tsx (조립 예시)
//
// 거래처 목록 페이지 — 서버 컴포넌트에서 데이터 조회 후 클라이언트 컴포넌트에 주입.
// 다른 페이지(work/finance/settings 등)도 동일 패턴으로 조립.
import { getCurrentUser } from "@/server/session";
import { listClientsForUser } from "@/server/repositories/clients";
import { getIndustryTree } from "@/server/repositories/masters";
import { ClientList } from "@/components/clients/ClientList";
import { ClientForm } from "@/components/clients/ClientForm";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { db } from "@/server/db";
import { Role } from "@/domain/types";

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // 미들웨어에서 /login 리다이렉트 전제

  const [rows, industries] = await Promise.all([listClientsForUser(user), getIndustryTree()]);
  const canCreate = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  const marketers = canCreate
    ? await db.user.findMany({ where: { role: Role.MARKETER, status: "ACTIVE" }, select: { id: true, name: true } })
    : [];

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <DashboardHeader
          eyebrow="거래처 관리"
          title="거래처"
          description="등록된 거래처와 담당자·업종·미수금 상태를 확인합니다. 거래처 코드는 등록 시 자동 발번됩니다."
        />
        <ClientList rows={rows} />
      </section>

      {canCreate && (
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="mb-4 text-sm font-bold text-ink">신규 거래처 등록</h2>
          <ClientForm industries={industries} marketers={marketers} />
        </section>
      )}
    </div>
  );
}
