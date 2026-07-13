import { cache } from "react";
import { unstable_cache } from "next/cache";
import { Role, UserStatus } from "@/domain/types";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  /** 실효 역할 — 최고관리자에게 승인받은 관리자는 SUPER_ADMIN처럼 동작한다. 앱 전역 권한 판정은 이 값을 쓴다. */
  role: Role;
  /** DB에 저장된 원래 역할 — 승격과 무관. 승격 부여 같은 "진짜 최고관리자만" 판정에 쓴다. */
  baseRole: Role;
  /** 관리자가 최고관리자 동등 권한을 승인받았는지 여부. */
  elevatedToSuperAdmin: boolean;
  canAccessSettings: boolean;
};

/** 승인된 관리자(ADMIN)는 최고관리자와 동등하게 동작. 그 외에는 원래 역할 그대로. */
function toEffectiveRole(baseRole: Role, elevated: boolean): Role {
  return baseRole === Role.ADMIN && elevated ? Role.SUPER_ADMIN : baseRole;
}

type SessionUserLike = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  authProvider?: string | null;
  authProviderAccountId?: string | null;
};

function parseRole(role: unknown): Role | null {
  if (role === Role.SUPER_ADMIN || role === Role.ADMIN || role === Role.MARKETER) {
    return role;
  }

  return null;
}

function buildUserLookup(user?: SessionUserLike | null) {
  const email = user?.email?.trim().toLowerCase();
  const provider = user?.authProvider?.trim();
  const providerAccountId = user?.authProviderAccountId?.trim();

  const identityWhere =
    provider && providerAccountId
      ? {
          accounts: {
            some: {
              provider,
              providerAccountId
            }
          }
        }
      : email
        ? { email }
        : null;

  if (!identityWhere) {
    return null;
  }

  return {
    isActive: true,
    status: UserStatus.ACTIVE,
    ...identityWhere
  };
}

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  isActive: true,
  canAccessSettings: true,
  elevatedToSuperAdmin: true
} as const;

// 이메일 로그인(주 경로)의 직원 조회를 요청 간 캐시 — 매 네비게이션마다 도는
// db.user.findFirst 왕복을 제거해 화면 전환 지연을 줄인다. 30초 후 자동 갱신
// (권한/상태 변경은 최대 30초 내 반영). 소셜 로그인은 캐시 없이 직접 조회.
const loadStaffByEmail = unstable_cache(
  async (email: string) =>
    db.user.findFirst({ where: { email, isActive: true, status: UserStatus.ACTIVE }, select: STAFF_SELECT }),
  ["staff-by-email"],
  { revalidate: 30 }
);

async function resolveStaffUser(user?: SessionUserLike | null): Promise<CurrentUser | null> {
  const email = user?.email?.trim().toLowerCase();
  const provider = user?.authProvider?.trim();
  const providerAccountId = user?.authProviderAccountId?.trim();

  let staffUser;
  if (!provider && !providerAccountId && email) {
    staffUser = await loadStaffByEmail(email);
  } else {
    const where = buildUserLookup(user);
    staffUser = where ? await db.user.findFirst({ where, select: STAFF_SELECT }) : null;
  }

  const baseRole = parseRole(staffUser?.role);

  if (!staffUser || !baseRole) {
    return null;
  }

  const elevatedToSuperAdmin = Boolean(staffUser.elevatedToSuperAdmin);

  return {
    id: staffUser.id,
    name: staffUser.name,
    email: staffUser.email,
    role: toEffectiveRole(baseRole, elevatedToSuperAdmin),
    baseRole,
    elevatedToSuperAdmin,
    canAccessSettings: staffUser.canAccessSettings
  };
}

function getDevUser(requestedRole?: unknown): CurrentUser | null {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_SESSION !== "true") {
    return null;
  }

  const role = parseRole(requestedRole) ?? parseRole(process.env.DEV_SESSION_ROLE) ?? Role.ADMIN;

  return {
    id: "dev-user",
    name: "Local Preview",
    email: "dev@marketing-erp.local",
    role,
    baseRole: role,
    elevatedToSuperAdmin: false,
    canAccessSettings: true
  };
}

// 세션→직원 조회(auth JWT 복호화 + user.findFirst)를 요청 단위로 캐시한다.
// 한 번의 네비게이션에서 레이아웃과 페이지가 각각 getCurrentUser를 호출해도
// DB 왕복이 1회로 합쳐져 클릭 반응이 빨라진다. devRole은 개발 폴백에만 쓰여 제외.
const loadSessionUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  return resolveStaffUser(session?.user as SessionUserLike | undefined);
});

export async function getCurrentUser(requestedDevRole?: unknown): Promise<CurrentUser | null> {
  try {
    const user = await loadSessionUser();
    return user ?? getDevUser(requestedDevRole);
  } catch {
    return getDevUser(requestedDevRole);
  }
}
