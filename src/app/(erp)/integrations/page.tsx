import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Role } from "@/domain/types";
import { getIntegrationStatuses } from "@/server/integrations/status";
import { getCurrentUser } from "@/server/session";

export default async function IntegrationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }
  if (user.role !== Role.SUPER_ADMIN) {
    redirect("/dashboard");
  }

  const statuses = getIntegrationStatuses();
  const connected = statuses.filter((status) => status.configured).length;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="설정"
        title="연동 관리"
        description="외부 API 연동 상태를 확인합니다. 환경 변수에 키를 넣으면 켜지고, 서버를 옮겨도 같은 키만 넣으면 됩니다."
      />

      <div className="rounded-md border border-line bg-surface/60 px-4 py-3 text-sm text-slate-600">
        전체 {statuses.length}개 중 <b className="text-ink">{connected}개 연동됨</b>. 미연동 연동은 대체 동작(데모/미리보기)으로
        안전하게 작동합니다.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {statuses.map((status) => (
          <div key={status.key} className="space-y-3 rounded-md border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{status.label}</p>
                <p className="text-sm text-slate-500">{status.description}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  status.configured ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {status.configured ? "● 연동됨" : "○ 미연동"}
              </span>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-slate-400">사용 위치</dt>
              <dd className="text-slate-700">{status.usedIn}</dd>
              <dt className="text-slate-400">미연동 시</dt>
              <dd className="text-slate-700">{status.fallback}</dd>
            </dl>

            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-400">필요한 환경 변수</p>
              <div className="flex flex-wrap gap-1.5">
                {status.envVars.map((name) => {
                  const set = Boolean(process.env[name]);
                  return (
                    <code
                      key={name}
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        set ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                      title={set ? "설정됨" : "미설정"}
                    >
                      {set ? "✓ " : ""}
                      {name}
                    </code>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        ※ 값은 표시하지 않고 설정 여부(✓)만 보여줍니다. 키는 배포 환경의 환경 변수에만 저장하세요.
      </p>
    </section>
  );
}
