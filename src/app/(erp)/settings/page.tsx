import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StaffPermissionManager } from "@/components/settings/StaffPermissionManager";
import { AdminPasswordCard } from "@/components/settings/AdminPasswordCard";
import { AdminScopeManager } from "@/components/settings/AdminScopeManager";
import { MarketerAssignment } from "@/components/settings/MarketerAssignment";
import { PendingApprovals } from "@/components/settings/PendingApprovals";
import { MasterManager } from "@/components/settings/MasterManager";
import { DocumentTemplateManager } from "@/components/settings/DocumentTemplateManager";
import { TemplateFiller } from "@/components/settings/TemplateFiller";
import { HrEvaluationPanel } from "@/components/settings/HrEvaluationPanel";
import Link from "next/link";
import type { Route } from "next";
import { listHrEvaluations } from "@/server/repositories/hr-evaluation";
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

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
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

  const { tab } = await searchParams;
  const activeTab: "staff" | "evaluation" = tab === "evaluation" ? "evaluation" : "staff";
  const evaluations = activeTab === "evaluation" ? await listHrEvaluations() : [];

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
        eyebrow="인사관리"
        title="인사관리"
        description="직원 권한·접근 범위·외부 연동을 관리하고, 인사관리평가로 직원을 주기별로 평가합니다."
      />

      {/* 인사관리 탭 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-1">
        {[
          { key: "staff", label: "직원·권한" },
          { key: "evaluation", label: "인사관리평가" }
        ].map((t) => {
          const on = t.key === activeTab;
          return (
            <Link
              key={t.key}
              href={`/settings?tab=${t.key}` as Route}
              aria-current={on ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${on ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:bg-surface"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {activeTab === "evaluation" && (
        <HrEvaluationPanel
          staff={overview.staff.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
          evaluations={evaluations}
        />
      )}

      {activeTab === "staff" && (
      <>
      {/* ① 직원 권한 — 사람 중심 통합 관리 (최고관리자) */}
      {isSuperAdmin ? (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">직원 권한</h3>
          <p className="text-sm text-slate-500">직원마다 <b>역할 · 메뉴 접근 · 설정 접근 · 로그인 링크</b>를 카드 하나에서 관리합니다. 각 직원을 펼쳐 스위치로 켜고 끄세요.</p>
          <StaffPermissionManager
            employees={overview.staff.map((member) => ({
              id: member.id,
              name: member.name,
              email: member.email,
              role: member.role,
              status: member.status,
              canAccessSettings: member.canAccessSettings,
              deniedFeatures: member.deniedFeatures
            }))}
            isSuperAdmin={isSuperAdmin}
            adminCanManageExpense={companySetting?.adminCanManageExpense ?? false}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-ink">내 계정</h3>
          <DataTable columns={staffColumns} rows={overview.staff} emptyMessage="조회 가능한 직원이 없습니다." />
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3 border-t border-line pt-6">
          <h3 className="text-base font-semibold text-ink">가입 승인 대기</h3>
          <p className="text-sm text-slate-500">직원이 로그인 화면에서 요청한 가입입니다. 승인하면 역할이 부여되고 로그인 링크 메일이 발송됩니다.</p>
          <PendingApprovals requests={pendingRequests.map((r) => ({ id: r.id, name: r.name, email: r.email, createdAt: r.createdAt.toISOString() }))} />
        </div>
      )}

      {/* ② 거래처 접근 범위 & 담당 배정 */}
      <div className="space-y-3 border-t border-line pt-6">
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

      {/* ③ 계정 · 연동 */}
      {isSuperAdmin && (
        <div className="space-y-3 border-t border-line pt-6">
          <h3 className="text-base font-semibold text-ink">로그인 비밀번호</h3>
          <AdminPasswordCard adminEmail={process.env.ADMIN_EMAIL ?? null} />
        </div>
      )}

      <div className="space-y-3 border-t border-line pt-6">
        <h3 className="text-base font-semibold text-ink">외부 연동 상태</h3>
        <p className="text-sm text-slate-500">이메일·캘린더·PG 등 외부 연동 준비 상태입니다.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {overview.integrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-3 border-t border-line pt-6">
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
      </>
      )}
    </section>
  );
}
