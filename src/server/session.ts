import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { Role, UserStatus } from "@/domain/types";
import { parseFeatureKeys, type FeatureKey } from "@/domain/features";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  canAccessSettings: boolean;
  deniedFeatures: FeatureKey[];
};

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

const STAFF_SELECT_BASE = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  isActive: true,
  canAccessSettings: true
} as const;

const STAFF_SELECT = { ...STAFF_SELECT_BASE, deniedFeatures: true } as const;

// deniedFeatures 컬럼이 아직 DB에 반영되지 않았어도 로그인/세션이 깨지지 않도록,
// 조회가 실패하면 그 컬럼 없이 재조회한다(게이팅은 기본 허용으로 동작). 로그인 직후
// getCurrentUser가 컬럼 부재로 던져 되튕기던 문제를 원천 차단.
async function findStaff(where: Prisma.UserWhereInput) {
  try {
    return await db.user.findFirst({ where, select: STAFF_SELECT });
  } catch {
    return await db.user.findFirst({ where, select: STAFF_SELECT_BASE });
  }
}

// 이메일 로그인(주 경로)의 직원 조회를 요청 간 캐시 — 매 네비게이션마다 도는
// db.user.findFirst 왕복을 제거해 화면 전환 지연을 줄인다. 30초 후 자동 갱신
// (권한/상태 변경은 최대 30초 내 반영). 소셜 로그인은 캐시 없이 직접 조회.
const loadStaffByEmail = unstable_cache(
  async (email: string) => findStaff({ email, isActive: true, status: UserStatus.ACTIVE }),
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
    staffUser = where ? await findStaff(where) : null;
  }

  const role = parseRole(staffUser?.role);

  if (!staffUser || !role) {
    return null;
  }

  return {
    id: staffUser.id,
    name: staffUser.name,
    email: staffUser.email,
    role,
    canAccessSettings: staffUser.canAccessSettings,
    // 폴백 조회 시 deniedFeatures가 없을 수 있음 → parseFeatureKeys가 안전 처리(빈 배열).
    deniedFeatures: parseFeatureKeys((staffUser as { deniedFeatures?: unknown }).deniedFeatures)
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
    canAccessSettings: true,
    deniedFeatures: []
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
