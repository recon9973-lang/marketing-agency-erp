// 목표 경로: src/server/actions/employees.ts
//
// 직원 초대/역할변경 + 회사 지출 정책 토글.
// 권한: 초대/역할변경=관리자 이상(단 SUPER_ADMIN 부여 불가), 지출토글=최고관리자.
"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { Role, UserStatus } from "@/domain/types";
import { parseFeatureKeys } from "@/domain/features";
import { signIn } from "@/server/auth";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

// 추측 불가한 개인 로그인 링크 토큰(32바이트 → base64url ~43자).
function newLoginToken(): string {
  return randomBytes(32).toString("base64url");
}

const inviteSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1),
  role: z.enum(["ADMIN", "MARKETER"]) // SUPER_ADMIN 초대 불가
});

/** 직원 초대 — INVITED 상태로 생성. 첫 로그인 시 auth 콜백에서 ACTIVE 전환. */
export async function inviteEmployee(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = inviteSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    const exists = await db.user.findFirst({ where: { email: d.email.toLowerCase() } });
    if (exists) throw new Error("VALIDATION"); // 이미 존재하는 이메일

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        // loginLinkToken 즉시 발급 → 관리자가 링크를 복사해 바로 전달 가능(메일 불필요).
        data: { email: d.email.toLowerCase(), name: d.name, role: d.role as never, status: UserStatus.INVITED, orgId, loginLinkToken: newLoginToken() }
      });
      await recordAudit(tx, { actorId: user.id, action: "employee.invite", targetType: "User", targetId: u.id, afterState: { email: u.email, role: u.role }, ...meta });
      return u;
    });

    // 초대 즉시 로그인(매직) 링크 메일 발송 — 받은 사람이 링크만 누르면 로그인.
    // 베스트에포트: 메일 발송이 실패해도 초대(명단 등록) 자체는 유효(관리자가 로그인 URL 공유 가능).
    try {
      await signIn("nodemailer", { email: d.email.toLowerCase(), redirect: false, redirectTo: "/dashboard" });
    } catch {
      /* SMTP 미설정/발송 실패는 초대를 막지 않음 */
    }

    revalidatePath("/settings");
    return { id: created.id };
  });
}

/**
 * 개인 로그인 링크 토큰 확보 — 없으면 생성, 있으면 그대로(또는 regenerate=true면 새로 발급해 기존 폐기).
 * 관리자가 이 토큰으로 /invite/{token} 링크를 만들어 직원에게 전달한다. (SUPER_ADMIN/ADMIN)
 */
export async function getOrCreateLoginLink(input: unknown): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ userId: z.string().min(1), regenerate: z.boolean().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const target = await db.user.findUnique({ where: { id: p.data.userId }, select: { id: true, role: true, loginLinkToken: true } });
    if (!target) throw new Error("NOT_FOUND");
    if (target.role === Role.SUPER_ADMIN) throw new Error("FORBIDDEN"); // 최고관리자는 비밀번호 로그인 사용

    let token = target.loginLinkToken;
    if (!token || p.data.regenerate) {
      token = newLoginToken();
      await db.user.update({ where: { id: target.id }, data: { loginLinkToken: token } });
    }
    revalidatePath("/settings");
    return { token };
  });
}

const roleSchema = z.object({ userId: z.string().min(1), role: z.enum(["ADMIN", "MARKETER"]) });

/** 역할 변경 — 관리자 허용. SUPER_ADMIN 부여/강등은 불가(권한 상승 방지). */
export async function changeRole(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = roleSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const target = await db.user.findUnique({ where: { id: p.data.userId } });
    if (!target) throw new Error("NOT_FOUND");
    if (target.role === Role.SUPER_ADMIN) throw new Error("FORBIDDEN"); // 최고관리자 대상 변경 불가

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: p.data.userId }, data: { role: p.data.role as never } });
      await recordAudit(tx, { actorId: user.id, action: "employee.changeRole", targetType: "User", targetId: p.data.userId, beforeState: { role: target.role }, afterState: { role: p.data.role }, ...meta });
    });
    revalidatePath("/settings");
  });
}

/** 설정(직원/권한) 화면 접근 승인 토글 — 최고관리자 전용. 관리자/담당자에게 부여/회수. */
export async function setSettingsAccess(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ userId: z.string().min(1), canAccess: z.boolean() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const target = await db.user.findUnique({ where: { id: p.data.userId } });
    if (!target) throw new Error("NOT_FOUND");
    if (target.role === Role.SUPER_ADMIN) throw new Error("FORBIDDEN"); // 최고관리자는 항상 접근, 토글 대상 아님

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: p.data.userId }, data: { canAccessSettings: p.data.canAccess } });
      await recordAudit(tx, {
        actorId: user.id,
        action: "employee.settingsAccess",
        targetType: "User",
        targetId: p.data.userId,
        beforeState: { canAccessSettings: target.canAccessSettings },
        afterState: { canAccessSettings: p.data.canAccess },
        ...meta
      });
    });
    revalidatePath("/settings");
  });
}

/** 기능(메뉴) 단위 접근 권한 설정 — 최고관리자 전용. deniedFeatures = 차단할 기능 키 목록. */
export async function setUserFeatureAccess(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ userId: z.string().min(1), deniedFeatures: z.array(z.string()) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const target = await db.user.findUnique({ where: { id: p.data.userId }, select: { role: true, deniedFeatures: true } });
    if (!target) throw new Error("NOT_FOUND");
    if (target.role === Role.SUPER_ADMIN) throw new Error("FORBIDDEN"); // 최고관리자는 항상 전체 접근

    const denied = parseFeatureKeys(p.data.deniedFeatures);
    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: p.data.userId }, data: { deniedFeatures: denied } });
      await recordAudit(tx, {
        actorId: user.id,
        action: "employee.featureAccess",
        targetType: "User",
        targetId: p.data.userId,
        beforeState: { deniedFeatures: parseFeatureKeys(target.deniedFeatures) },
        afterState: { deniedFeatures: denied },
        ...meta
      });
    });
    revalidatePath("/settings");
    revalidatePath("/dashboard");
  });
}

/** 회사 지출 관리 권한 토글 — 최고관리자 전용. */
export async function setExpensePolicy(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ adminCanManageExpense: z.boolean() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      const existing = await tx.companySetting.findFirst();
      if (existing) await tx.companySetting.update({ where: { id: existing.id }, data: { adminCanManageExpense: p.data.adminCanManageExpense } });
      else await tx.companySetting.create({ data: { adminCanManageExpense: p.data.adminCanManageExpense } });
      await recordAudit(tx, { actorId: user.id, action: "setting.expensePolicy", targetType: "CompanySetting", targetId: "singleton", afterState: { adminCanManageExpense: p.data.adminCanManageExpense }, ...meta });
    });
    revalidatePath("/settings");
  });
}
