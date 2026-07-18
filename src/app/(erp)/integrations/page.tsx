import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Role } from "@/domain/types";
import { getIntegrationStatuses, type IntegrationCategory, type IntegrationStatus } from "@/server/integrations/status";
import { getCurrentUser } from "@/server/session";

// env를 요청 시점에 읽어 연동 상태를 정확히 반영.
export const dynamic = "force-dynamic";

const CATEGORY_ORDER: IntegrationCategory[] = ["코어", "AI", "메시지·메일", "데이터·광고", "제작·발행", "결제", "캘린더"];

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 연결됨
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> 미설정
    </span>
  );
}

function IntegrationCard({ item }: { item: IntegrationStatus }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{item.label}</p>
          <p className="mt-1 text-sm text-slate-500">{item.description}</p>
        </div>
        <StatusBadge configured={item.configured} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.envVars.map((v) => (
          <code key={v} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{v}</code>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs text-slate-500">
        <div><span className="text-slate-400">사용처</span> · {item.usedIn}</div>
        {!item.configured ? <div className="text-right"><span className="text-slate-400">미설정 시</span> · {item.fallback}</div> : null}
      </div>
    </div>
  );
}

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== Role.SUPER_ADMIN && !user.canAccessSettings) redirect("/dashboard");

  const statuses = getIntegrationStatuses();
  const connected = statuses.filter((s) => s.configured).length;

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="외부 연동"
        title="연동 관리"
        description="모든 외부 연동은 환경 변수(env)에 키를 넣으면 자동으로 켜집니다. 아래에서 현재 연결 상태와 필요한 키를 확인하세요."
      />

      <div className="rounded-xl border border-line bg-surface/60 px-4 py-3 text-sm text-slate-600">
        연결됨 <b className="text-emerald-600">{connected}</b> / 전체 {statuses.length}개 · 미설정 항목은 표시된 <code className="rounded bg-white px-1 font-mono text-[11px]">ENV_KEY</code>를 Vercel 환경 변수에 넣고 재배포하면 켜집니다.
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = statuses.filter((s) => s.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h3 className="text-sm font-bold text-brand-strong">{category}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((item) => (
                <IntegrationCard key={item.key} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
