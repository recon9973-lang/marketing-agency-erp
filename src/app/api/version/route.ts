// 진단용 — 라이브 배포에서 부트스트랩 로그인의 각 단계를 서버에서 직접 재현해 실패 지점을 특정.
import { NextResponse } from "next/server";
import { verifyPassword } from "@/server/security/password";
import { db } from "@/server/db";
import { Role, UserStatus } from "@/domain/types";

export const dynamic = "force-dynamic";

const BOOTSTRAP_HASH =
  "scrypt$6d2561332f18d574604d1c9447dc0c3a$fad8ab94953d4c59ba91f1167078a0885904b819d4c00228415c54cbabbbb8bb4fed3603fa23988fd636f40ba1285b92d3a6b5e6b933b1c677667223ad059515";

export async function GET() {
  let verifyBootstrap: boolean | string = false;
  try {
    verifyBootstrap = verifyPassword("venomadmin2026", BOOTSTRAP_HASH);
  } catch (e) {
    verifyBootstrap = `ERROR: ${String(e).slice(0, 300)}`;
  }

  let upsertOk: boolean | string = false;
  try {
    await db.user.upsert({
      where: { email: "admin@venom.app" },
      update: { status: UserStatus.ACTIVE, isActive: true, role: Role.SUPER_ADMIN, canAccessSettings: true },
      create: {
        email: "admin@venom.app",
        name: "최고관리자",
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        isActive: true,
        canAccessSettings: true
      },
      select: { id: true }
    });
    upsertOk = true;
  } catch (e) {
    upsertOk = `ERROR: ${String(e).slice(0, 400)}`;
  }

  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
    builtMarker: "auth-diag-v3",
    verifyBootstrap, // true 여야 정상
    upsertOk // true 여야 정상 — ERROR면 DB 계정생성이 실패(컬럼/제약 등)
  });
}
