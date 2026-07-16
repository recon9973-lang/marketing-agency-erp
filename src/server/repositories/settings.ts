import { ConnectionStatus, FinancialAccountType, Role, UserStatus } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type StaffSettingsItem = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  canAccessSettings: boolean;
  kakaoLinked: boolean;
  googleCalendarConnected: boolean;
  naverCalendarConnected: boolean;
};

export type ScopeSettingsItem = {
  id: string;
  adminId: string;
  adminName: string;
  marketerId: string | null;
  marketerName: string | null;
  clientId: string | null;
  clientName: string | null;
  allMarketers: boolean;
  allClients: boolean;
};

export type ClientPickItem = { id: string; name: string; assignedMarketerId: string | null };

export type IntegrationSettingsItem = {
  id: string;
  label: string;
  status: ConnectionStatus;
  detail: string;
};

export type SettingsOverview = {
  staff: StaffSettingsItem[];
  scopes: ScopeSettingsItem[];
  clients: ClientPickItem[];
  integrations: IntegrationSettingsItem[];
};

export async function fetchSettingsOverview(user: CurrentUser): Promise<SettingsOverview> {
  const isSuper = user.role === Role.SUPER_ADMIN;
  const [staff, scopes, accounts, clients] = await Promise.all([
    db.user.findMany({
      where: user.role === Role.SUPER_ADMIN ? {} : { id: user.id },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        canAccessSettings: true,
        kakaoId: true,
        googleCalendarConnected: true,
        naverCalendarConnected: true
      }
    }),
    db.accessScope.findMany({
      where: user.role === Role.SUPER_ADMIN ? {} : { adminId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        adminId: true,
        marketerId: true,
        clientId: true,
        allMarketers: true,
        allClients: true,
        admin: { select: { name: true } },
        marketer: { select: { name: true } },
        client: { select: { name: true } }
      }
    }),
    db.financialAccount.findMany({
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        type: true,
        displayName: true,
        institutionName: true,
        connectionStatus: true
      }
    }),
    // 거래처 선택기용 목록(최고관리자만 필요). 편집 UI의 '특정 거래처' 선택에 사용.
    isSuper
      ? db.client.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, assignedMarketerId: true } })
      : Promise.resolve([])
  ]);

  return {
    staff: staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
      canAccessSettings: member.canAccessSettings,
      kakaoLinked: Boolean(member.kakaoId),
      googleCalendarConnected: member.googleCalendarConnected,
      naverCalendarConnected: member.naverCalendarConnected
    })),
    scopes: scopes.map((scope) => ({
      id: scope.id,
      adminId: scope.adminId,
      adminName: scope.admin.name,
      marketerId: scope.marketerId,
      marketerName: scope.marketer?.name ?? null,
      clientId: scope.clientId,
      clientName: scope.client?.name ?? null,
      allMarketers: scope.allMarketers,
      allClients: scope.allClients
    })),
    clients,
    integrations: [
      {
        id: "kakao-login",
        label: "Kakao Login",
        status: ConnectionStatus.CONNECTED,
        detail: "Auth.js Kakao OAuth 환경변수로 연결"
      },
      {
        id: "google-calendar",
        label: "Google Calendar",
        status: staff.some((member) => member.googleCalendarConnected) ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED,
        detail: "직원별 OAuth 연결 준비"
      },
      {
        id: "naver-calendar",
        label: "Naver Calendar",
        status: staff.some((member) => member.naverCalendarConnected) ? ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED,
        detail: "네이버 캘린더 API 연결 준비"
      },
      {
        id: "pg-v2",
        label: "PG 결제 V2",
        status: ConnectionStatus.DISCONNECTED,
        detail: "TossPayments/Inicis/KakaoPay provider 필드 준비"
      },
      ...accounts.map((account) => ({
        id: account.id,
        label: account.type === FinancialAccountType.BANK ? `은행 ${account.displayName}` : `카드 ${account.displayName}`,
        status: account.connectionStatus,
        detail: account.institutionName ?? "기관 미등록"
      }))
    ]
  };
}
