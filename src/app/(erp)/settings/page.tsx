import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConnectionStatus, Role, UserStatus } from "@/domain/types";
import {
  fetchSettingsOverview,
  type IntegrationSettingsItem,
  type ScopeSettingsItem,
  type StaffSettingsItem
} from "@/server/repositories/settings";
import { getCurrentUser } from "@/server/session";

const roleLabels: Record<Role, string> = {
  [Role.SUPER_ADMIN]: "최고관리자",
  [Role.ADMIN]: "관리자",
  [Role.MARKETER]: "담당자"
};

const userStatusLabels: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: "활성",
  [UserStatus.INVITED]: "초대",
  [UserStatus.SUSPENDED]: "정지"
};

function connectionLabel(status: ConnectionStatus) {
  if (status === ConnectionStatus.CONNECTED) return "연결됨";
  if (status === ConnectionStatus.ERROR) return "확인필요";
  return "연동 준비";
}

const staffColumns: DataTableColumn<StaffSettingsItem>[] = [
  {
    key: "name",
    header: "직원",
    render: (member) => (
      <div>
        <p className="font-medium text-ink">{member.name}</p>
        <p className="mt-1 text-xs text-slate-500">{member.email}</p>
      </div>
    )
  },
  {
    key: "role",
    header: "권한",
    render: (member) => roleLabels[member.role]
  },
  {
    key: "status",
    header: "상태",
    render: (member) => userStatusLabels[member.status]
  },
  {
    key: "kakao",
    header: "카카오",
    render: (member) => (member.kakaoLinked ? "연결" : "대기")
  },
  {
    key: "calendar",
    header: "캘린더",
    render: (member) => `${member.googleCalendarConnected ? "Google" : "-"} / ${member.naverCalendarConnected ? "Naver" : "-"}`
  }
];

const scopeColumns: DataTableColumn<ScopeSettingsItem>[] = [
  {
    key: "admin",
    header: "관리자",
    render: (scope) => scope.adminName
  },
  {
    key: "marketer",
    header: "담당자 범위",
    render: (scope) => (scope.allMarketers ? "전체 담당자" : scope.marketerName ?? "-")
  },
  {
    key: "client",
    header: "거래처 범위",
    render: (scope) => (scope.allClients ? "전체 거래처" : scope.clientName ?? "-")
  }
];

function IntegrationCard({ integration }: { integration: IntegrationSettingsItem }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{integration.label}</p>
          <p className="mt-1 text-sm text-slate-500">{integration.detail}</p>
        </div>
        <span className="rounded-md border border-line bg-surface px-3 py-1 text-xs font-semibold text-slate-600">{connectionLabel(integration.status)}</span>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const overview = await fetchSettingsOverview(user);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="설정"
        title="직원 권한 및 외부 연동 설정"
        description="직원 역할, 관리자 접근 범위, Kakao 로그인, 구글/네이버 캘린더, 향후 PG와 계좌·카드 연동 준비 상태를 확인합니다."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {overview.integrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">{user.role === Role.SUPER_ADMIN ? "직원 권한" : "내 계정"}</h3>
        <DataTable columns={staffColumns} rows={overview.staff} emptyMessage="조회 가능한 직원이 없습니다." />
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">관리자 접근 범위</h3>
        <DataTable columns={scopeColumns} rows={overview.scopes} emptyMessage="등록된 접근 범위가 없습니다." />
      </div>
    </section>
  );
}
