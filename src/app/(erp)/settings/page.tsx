import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmployeeSettings } from "@/components/settings/EmployeeSettings";
import { AdminPasswordCard } from "@/components/settings/AdminPasswordCard";
import { AdminScopeManager } from "@/components/settings/AdminScopeManager";
import { MarketerAssignment } from "@/components/settings/MarketerAssignment";
import { FeaturePermissions } from "@/components/settings/FeaturePermissions";
import { PendingApprovals } from "@/components/settings/PendingApprovals";
import { MasterManager } from "@/components/settings/MasterManager";
import { DocumentTemplateManager } from "@/components/settings/DocumentTemplateManager";
import { TemplateFiller } from "@/components/settings/TemplateFiller";
import { listAllTemplates, listTemplatesForUse } from "@/server/repositories/document-templates";
import { ConnectionStatus, Role, UserStatus } from "@/domain/types";
import { db } from "@/server/db";
import { getWorkCategories } from "@/server/repositories/masters";
import {
  fetchSettingsOverview,
  type IntegrationSettingsItem,
  type ScopeSettingsItem,
  type SettingsOverview,
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
  [UserStatus.SUSPENDED]: "정지",
  [UserStatus.PENDING]: "승인대기"
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
    <div className="rounded-2xl border border-line bg-white p-4">
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

  // 최고관리자이거나, 최고관리자에게 설정 접근을 승인받은 직원만 열람.
  if (user.role !== Role.SUPER_ADMIN && !user.canAccessSettings) {
    redirect("/dashboard");
  }

  const isAdmin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
  const isSuperAdmin = user.role === Role.SUPER_ADMIN;

  // 각 데이터 소스에 방어 — 하나가 실패(스키마 드리프트 등)해도 설정 화면 전체가 죽지 않게.
  // (특히 비밀번호 변경 카드는 데이터에 의존하지 않으므로 항상 뜨도록.) 실패는 로그로 남긴다.
  const emptyOverview: SettingsOverview = { staff: [], scopes: [], clients: [], integrations: [] };
  const warn = (where: string) => (e: unknown) => {
    console.warn(`[settings] ${where} 로드 실패: ${String(e).slice(0, 140)}`);
    return undefined;
  };
  const [overview, workCategories, companySetting, docTemplates, usableTemplates, pendingRequests] = await Promise.all([
    fetchSettingsOverview(user).catch((e) => (warn("overview")(e), emptyOverview)),
    (isAdmin ? getWorkCategories() : Promise.resolve([])).catch((e) => (warn("workCategories")(e), [])),
    (isSuperAdmin ? db.companySetting.findFirst() : Promise.resolve(null)).catch((e) => (warn("companySetting")(e), null)),
    (isAdmin ? listAllTemplates() : Promise.resolve([])).catch((e) => (warn("docTemplates")(e), [])),
    listTemplatesForUse(["HR", "GENERAL"], user.role).catch((e) => (warn("usableTemplates")(e), [])),
    isAdmin
      ? db.user
          .findMany({ where: { status: UserStatus.PENDING }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, createdAt: true } })
          .catch(() => [] as { id: string; name: string; email: string; createdAt: Date }[]) // enum 미반영 등에도 설정 화면이 깨지지 않게
      : Promise.resolve([])
  ]);

  return (
    <section className="space-y-6">
      <DashboardHeader
        eyebrow="설정"
        title="직원 권한 및 외부 연동 설정"
        description="직원 역할, 관리자 접근 범위, 이메일 로그인, 구글/네이버 캘린더, 향후 PG와 계좌·카드 연동 준비 상태를 확인합니다."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {overview.integrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

      {/* 최고관리자는 아래 '직원 초대·권한'에서 편집 가능한 목록을 보므로 읽기 전용 표는 본인 계정에만 노출. */}
      {!isSuperAdmin && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">내 계정</h3>
          <DataTable columns={staffColumns} rows={overview.staff} emptyMessage="조회 가능한 직원이 없습니다." />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">관리자 접근 범위</h3>
        <p className="text-sm text-slate-500">관리자(ADMIN)가 볼 수 있는 담당자·거래처 범위를 지정합니다. 최고관리자는 전체, 담당자는 본인 거래처만 봅니다.</p>
        {isSuperAdmin ? (
          <AdminScopeManager
            admins={overview.staff.filter((m) => m.role === Role.ADMIN).map((m) => ({ id: m.id, name: m.name }))}
            marketers={overview.staff.filter((m) => m.role === Role.MARKETER).map((m) => ({ id: m.id, name: m.name }))}
            clients={overview.clients}
            scopes={overview.scopes}
          />
        ) : (
          <DataTable columns={scopeColumns} rows={overview.scopes} emptyMessage="등록된 접근 범위가 없습니다." />
        )}
      </div>

      {isAdmin && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">가입 승인 대기</h3>
          <p className="text-sm text-slate-500">직원이 로그인 화면에서 요청한 가입입니다. 승인하면 역할이 부여되고 로그인 링크 메일이 발송됩니다.</p>
          <PendingApprovals requests={pendingRequests.map((r) => ({ id: r.id, name: r.name, email: r.email, createdAt: r.createdAt.toISOString() }))} />
        </div>
      )}

      {isSuperAdmin && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">기능 접근 권한</h3>
          <p className="text-sm text-slate-500">직원별로 메뉴 접근을 켜고 끕니다. 끄면 사이드바에서 숨겨지고 URL로 들어와도 차단됩니다.</p>
          <FeaturePermissions
            members={overview.staff
              .filter((m) => m.role !== Role.SUPER_ADMIN)
              .map((m) => ({ id: m.id, name: m.name, role: m.role, deniedFeatures: m.deniedFeatures }))}
          />
        </div>
      )}

      {isSuperAdmin && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">담당자 배정 현황</h3>
          <p className="text-sm text-slate-500">담당자(마케터)별 담당 거래처를 확인하고 다른 담당자로 이동합니다. 이동 시 미완료 업무도 함께 이관됩니다.</p>
          <MarketerAssignment
            marketers={overview.staff.filter((m) => m.role === Role.MARKETER).map((m) => ({ id: m.id, name: m.name }))}
            clients={overview.clients}
          />
        </div>
      )}

      {isSuperAdmin && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">로그인 비밀번호</h3>
          <AdminPasswordCard adminEmail={process.env.ADMIN_EMAIL ?? null} />
        </div>
      )}

      {isSuperAdmin && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">직원 초대 및 권한 관리</h3>
          <EmployeeSettings
            employees={overview.staff.map((member) => ({
              id: member.id,
              name: member.name,
              email: member.email,
              role: member.role,
              status: member.status,
              canAccessSettings: member.canAccessSettings
            }))}
            isSuperAdmin={isSuperAdmin}
            adminCanManageExpense={companySetting?.adminCanManageExpense ?? false}
          />
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">업무 카테고리 마스터</h3>
          <MasterManager
            items={workCategories.map((item) => ({
              id: item.id,
              name: item.name,
              group: item.group,
              colorTag: item.colorTag,
              isLocked: item.isLocked
            }))}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">서식(문서 템플릿) 관리</h3>
          <DocumentTemplateManager templates={docTemplates} />
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-ink">인사·일반 서식 발급</h3>
        <p className="text-sm text-slate-500">근로계약서·재직증명서 등 서식을 골라 항목을 채우고 인쇄/PDF로 발급합니다.</p>
        <TemplateFiller templates={usableTemplates} />
      </div>
    </section>
  );
}
