// 목표 경로: src/app/(erp)/clients/page.tsx (조립 예시)
//
// 거래처 목록 페이지 — 서버 컴포넌트에서 데이터 조회 후 클라이언트 컴포넌트에 주입.
// 다른 페이지(work/finance/settings 등)도 동일 패턴으로 조립.
import { getCurrentUser } from "@/server/session";
import { listClientsForUser } from "@/server/repositories/clients";
import { getIndustryTree } from "@/server/repositories/masters";
import { ClientList } from "@/components/clients/ClientList";
import { ClientBoard } from "@/components/clients/ClientBoard";
import { ClientForm } from "@/components/clients/ClientForm";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { db } from "@/server/db";
import { Role } from "@/domain/types";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null; // 미들웨어에서 /login 리다이렉트 전제

  const view = (await searchParams).view === "board" ? "board" : "list";
  const [rows, industries] = await Promise.all([listClientsForUser(user), getIndustryTree()]);
  const canCreate = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  const marketers = canCreate
    ? await db.user.findMany({ where: { role: Role.MARKETER, status: "ACTIVE" }, select: { id: true, name: true } })
    : [];

  return (
    <div className="space-y-6">
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <DashboardHeader
            eyebrow="거래처 관리"
            title="거래처"
            description="등록된 거래처와 담당자·업종·미수금 상태를 확인합니다. 거래처 코드는 등록 시 자동 발번됩니다."
          />
          <div className="inline-flex shrink-0 rounded-lg border border-line bg-surface p-0.5">
            <a href="/clients" className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${view === "list" ? "bg-card text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>목록</a>
            <a href="/clients?view=board" className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${view === "board" ? "bg-card text-brand shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>파이프라인</a>
          </div>
        </div>
        {view === "board" ? <ClientBoard rows={rows} /> : <ClientList rows={rows} />}
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
