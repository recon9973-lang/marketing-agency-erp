import "server-only";
import { db } from "@/server/db";

/**
 * User 테이블 스키마 자가치유(멱등·additive 전용).
 * 빌드 시 prisma db push / sync-additive 가 지연·스킵되면 loginLinkToken·deniedFeatures·
 * canAccessSettings 등 나중에 추가된 컬럼이 운영 DB에 없어 직원 초대/설정 조회가 P2022로 실패한다.
 * 초대·설정 조회 직전에 컬럼을 보강한다. 인스턴스당 1회만 실행되도록 프로미스를 메모이즈.
 */
let ensured: Promise<void> | null = null;

export function ensureUserColumns() {
  if (!ensured) {
    ensured = (async () => {
      const stmts = [
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canAccessSettings" BOOLEAN NOT NULL DEFAULT false',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kakaoId" TEXT',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "loginLinkToken" TEXT',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deniedFeatures" JSONB',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT false',
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "naverCalendarConnected" BOOLEAN NOT NULL DEFAULT false',
        'CREATE UNIQUE INDEX IF NOT EXISTS "User_loginLinkToken_key" ON "User"("loginLinkToken")',
        'CREATE UNIQUE INDEX IF NOT EXISTS "User_kakaoId_key" ON "User"("kakaoId")'
      ];
      for (const sql of stmts) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch (e) {
          console.warn("[ensure-user] 컬럼 보강 실패(무시):", String(e).slice(0, 140));
        }
      }
    })().catch(() => {
      ensured = null; // 실패 시 다음 호출에서 재시도.
    });
  }
  return ensured;
}
