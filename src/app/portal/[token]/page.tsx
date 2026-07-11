// 목표 경로: src/app/portal/[token]/page.tsx
//
// 거래처 포털(공개) — 로그인 불필요. portalToken으로만 접근. (erp) 레이아웃 밖.
import { ClientPortalView } from "@/components/portal/ClientPortalView";
import { getClientPortal } from "@/server/repositories/client-portal";

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const portal = await getClientPortal(token);

  if (!portal) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl bg-surface px-4 py-10">
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-slate-500">유효하지 않은 포털 링크입니다.</div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-semibold text-brand-strong">주식회사 베놈 · 거래처 포털</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{portal.clientName}</h1>
        <p className="mt-1 text-sm text-slate-500">콘텐츠 컨펌, 월간 보고서 확인, 피드백을 남기실 수 있습니다.</p>
      </header>
      <ClientPortalView token={token} reports={portal.reports} reviewPlans={portal.reviewPlans} performance={portal.performance} />
    </main>
  );
}
