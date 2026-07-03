import { Role, UserStatus } from "@/domain/types";
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  canAccessSettings: boolean;
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

async function resolveStaffUser(user?: SessionUserLike | null): Promise<CurrentUser | null> {
  const where = buildUserLookup(user);

  if (!where) {
    return null;
  }

  const staffUser = await db.user.findFirst({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
      canAccessSettings: true
    }
  });

  const role = parseRole(staffUser?.role);

  if (!staffUser || !role) {
    return null;
  }

  return {
    id: staffUser.id,
    name: staffUser.name,
    email: staffUser.email,
    role,
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
    canAccessSettings: true
  };
}

export async function getCurrentUser(requestedDevRole?: unknown): Promise<CurrentUser | null> {
  try {
    const session = await auth();
    const user = await resolveStaffUser(session?.user as SessionUserLike | undefined);
    return user ?? getDevUser(requestedDevRole);
  } catch {
    return getDevUser(requestedDevRole);
  }
}
