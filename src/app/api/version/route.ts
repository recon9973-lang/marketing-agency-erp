// 진단 + 자동복구 — 부트스트랩 로그인 3단계를 서버에서 재현하고, 컬럼 누락이면 즉시 보강.
import { NextResponse } from "next/server";
import { verifyPassword } from "@/server/security/password";
import { db } from "@/server/db";
import { Role, UserStatus } from "@/domain/types";

export const dynamic = "force-dynamic";

const BOOTSTRAP_HASH =
  "scrypt$6d2561332f18d574604d1c9447dc0c3a$fad8ab94953d4c59ba91f1167078a0885904b819d4c00228415c54cbabbbb8bb4fed3603fa23988fd636f40ba1285b92d3a6b5e6b933b1c677667223ad059515";
const EMAIL = "admin@venom.app";

async function doUpsert() {
  return db.user.upsert({
    where: { email: EMAIL },
    update: { status: UserStatus.ACTIVE, isActive: true, role: Role.SUPER_ADMIN, canAccessSettings: true },
    create: { email: EMAIL, name: "최고관리자", role: Role.SUPER_ADMIN, status: UserStatus.ACTIVE, isActive: true, canAccessSettings: true },
    select: { id: true }
  });
}

export async function GET() {
  const out: Record<string, unknown> = { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown", marker: "auth-diag-v4" };

  // 1) 비밀번호 검증
  try {
    out.verifyBootstrap = verifyPassword("venomadmin2026", BOOTSTRAP_HASH);
  } catch (e) {
    out.verifyBootstrap = `ERROR: ${String(e).slice(0, 300)}`;
  }

  // 2) DB 계정 생성(upsert) — 실패하면 누락 컬럼 보강 후 재시도(자동복구)
  try {
    await doUpsert();
    out.upsertOk = true;
  } catch (e1) {
    out.upsertError = String(e1).slice(0, 400);
    try {
      await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT');
      await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deniedFeatures" JSONB');
      out.healedColumns = true;
      await doUpsert();
      out.upsertOk = true;
    } catch (e2) {
      out.upsertOk = `ERROR after heal: ${String(e2).slice(0, 400)}`;
    }
  }

  // 3) 로그인 화이트리스트(signIn 콜백)가 이 계정을 찾는지
  try {
    const staff = await db.user.findFirst({ where: { email: EMAIL, status: { in: [UserStatus.ACTIVE, UserStatus.INVITED] } }, select: { id: true, status: true } });
    out.staffFound = Boolean(staff);
  } catch (e) {
    out.staffFound = `ERROR: ${String(e).slice(0, 300)}`;
  }

  return NextResponse.json(out);
}
