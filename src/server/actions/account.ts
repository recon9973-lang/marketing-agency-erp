// 목표 경로: src/server/actions/account.ts
//
// ERP 관리자 로그인 비밀번호 관리 — 현재 비밀번호 확인 후 새 비밀번호를 해시로 DB 저장.
// 저장되면 로그인(auth.ts)이 DB 해시를 우선 검증한다. env ADMIN_PASSWORD는 복구용으로 유지.
"use server";

import { z } from "zod";

import { db } from "@/server/db";
import { Role, UserStatus } from "@/domain/types";
import { hashPassword, verifyPassword } from "@/server/security/password";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

function normalize(v: string): string {
  // ₩(한국 윈도우 백슬래시 키)·스마트 따옴표 통일 — 맥↔윈도우 로그인 불일치 방지.
  return v
    .normalize("NFKC")
    .replace(/₩/g, "\\")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
}

export async function changeAdminPassword(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");

    const p = z
      .object({
        current: z.string().min(1),
        next: z.string().min(1),
        confirm: z.string().min(1)
      })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const next = normalize(p.data.next);
    if (next.length < 8) throw new Error("TOO_SHORT");
    if (normalize(p.data.confirm) !== next) throw new Error("MISMATCH");

    const adminEmail = normalize(process.env.ADMIN_EMAIL ?? "").toLowerCase();
    if (!adminEmail) throw new Error("NO_ADMIN_EMAIL");

    // 현재 비밀번호 확인 — DB 해시(있으면) 또는 env ADMIN_PASSWORD(복구용) 중 하나라도 맞아야 한다.
    // 조회 실패(스키마 드리프트 등)에도 잠기지 않도록 방어 — env 비밀번호로 폴백 확인.
    let adminUser: { id: string; passwordHash: string | null } | null = null;
    try {
      adminUser = await db.user.findUnique({ where: { email: adminEmail }, select: { id: true, passwordHash: true } });
    } catch {
      adminUser = null;
    }
    const envPassword = normalize(process.env.ADMIN_PASSWORD ?? "");
    const currentOk =
      verifyPassword(p.data.current, adminUser?.passwordHash) ||
      (envPassword.length > 0 && normalize(p.data.current) === envPassword);
    if (!currentOk) throw new Error("WRONG_CURRENT");

    const passwordHash = hashPassword(next);
    const meta = await requestMeta();
    // 운영 DB에 passwordHash 컬럼이 없던 경우(빌드 시 db push/additive-sync 누락) 대비.
    // 멱등·additive DDL로 컬럼을 보장 — 없으면 P2022로 저장이 실패하므로 저장 직전에 확인한다.
    try {
      await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT');
    } catch (e) {
      console.warn("[account] passwordHash 컬럼 보장 실패(무시):", String(e).slice(0, 140));
    }
    // 비밀번호 저장이 핵심 — 감사로그 쓰기(스키마 드리프트 가능)에 발목 잡히지 않게 분리한다.
    const saved = await db.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash },
      create: {
        email: adminEmail,
        name: "최고관리자",
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        isActive: true,
        canAccessSettings: true,
        passwordHash
      },
      select: { id: true }
    });
    // 저장 검증 — 로그인이 읽는 것과 동일한 경로로 다시 읽어 새 비밀번호가 검증되는지 확인.
    // '저장은 됐다는데 로그인은 옛 비번만 받는' 현상(반영 지연/경로 불일치)을 조기에 잡는다.
    let readback: { passwordHash: string | null } | null = null;
    try {
      readback = await db.user.findUnique({ where: { email: adminEmail }, select: { passwordHash: true } });
    } catch (e) {
      console.warn("[account] 저장 검증 재조회 실패:", String(e).slice(0, 140));
    }
    if (!verifyPassword(next, readback?.passwordHash)) {
      console.error("[account] 비밀번호 저장 검증 실패 — 재조회 해시 불일치", { hasHash: Boolean(readback?.passwordHash) });
      throw new Error("SAVE_UNVERIFIED");
    }

    // 비밀번호 값은 절대 기록하지 않는다 — 변경 사실만 남긴다. 실패해도 변경은 유지(best-effort).
    try {
      await recordAudit(db, {
        actorId: user.id,
        action: "admin.password.change",
        targetType: "User",
        targetId: adminUser?.id ?? saved.id,
        ...meta
      });
    } catch (e) {
      console.warn("[account] 비밀번호 변경 감사로그 실패:", String(e).slice(0, 140));
    }
  });
}
