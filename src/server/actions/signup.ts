// 목표 경로: src/server/actions/signup.ts
//
// 셀프 가입 요청(공개) → 관리자 승인/거절. 승인 전(PENDING)엔 로그인 불가.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { signIn } from "@/server/auth";
import { Role, UserStatus } from "@/domain/types";
import { getDefaultOrgId } from "@/server/org";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const requestSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(60)
});

/** 셀프 가입 요청 — 공개(로그인 불필요). PENDING 사용자로 등록, 관리자 승인 전 로그인 불가. */
export async function requestSignup(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = requestSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const email = p.data.email.toLowerCase();
    const name = p.data.name;

    // 이미 등록/요청된 이메일이면 조용히 성공(계정 존재 여부 열거 방지).
    const exists = await db.user.findFirst({ where: { email }, select: { id: true } });
    if (exists) return;

    const orgId = await getDefaultOrgId();
    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, name, role: Role.MARKETER, status: UserStatus.PENDING, orgId }
      });
      await recordAudit(tx, { actorId: u.id, action: "signup.request", targetType: "User", targetId: u.id, afterState: { email }, ...meta });
      // 관리자에게 알림.
      const admins = await tx.user.findMany({
        where: { role: { in: [Role.SUPER_ADMIN, Role.ADMIN] }, status: UserStatus.ACTIVE },
        select: { id: true }
      });
      for (const a of admins) {
        await tx.notification.create({
          data: { userId: a.id, type: "SIGNUP_REQUEST", title: "새 가입 요청", body: `${name} (${email}) 님이 가입을 요청했습니다.`, link: "/settings", targetType: "User", targetId: u.id, orgId }
        });
      }
    });
    revalidatePath("/settings");
  });
}

const approveSchema = z.object({ userId: z.string().min(1), role: z.enum(["ADMIN", "MARKETER"]) });

/** 가입 요청 승인 — 관리자 이상. PENDING → INVITED + 역할 지정, 로그인 링크 메일 발송. */
export async function approveSignup(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = approveSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const target = await db.user.findUnique({ where: { id: p.data.userId }, select: { id: true, email: true, status: true } });
    if (!target) throw new Error("NOT_FOUND");
    if (target.status !== UserStatus.PENDING) throw new Error("VALIDATION"); // 대기 상태만 승인

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { status: UserStatus.INVITED, role: p.data.role as never, isActive: true } });
      await recordAudit(tx, { actorId: user.id, action: "signup.approve", targetType: "User", targetId: target.id, afterState: { role: p.data.role }, ...meta });
    });

    // 승인 즉시 로그인(매직) 링크 메일 발송 — 베스트에포트(실패해도 승인은 유효).
    try {
      await signIn("nodemailer", { email: target.email, redirect: false, redirectTo: "/dashboard" });
    } catch {
      /* SMTP 미설정/발송 실패는 승인을 막지 않음 */
    }

    revalidatePath("/settings");
  });
}

/** 가입 요청 거절 — 관리자 이상. PENDING 사용자 삭제. */
export async function rejectSignup(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ userId: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");

    const target = await db.user.findUnique({ where: { id: p.data.userId }, select: { id: true, status: true } });
    if (!target) throw new Error("NOT_FOUND");
    if (target.status !== UserStatus.PENDING) throw new Error("VALIDATION");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: target.id } });
      await recordAudit(tx, { actorId: user.id, action: "signup.reject", targetType: "User", targetId: target.id, ...meta });
    });
    revalidatePath("/settings");
  });
}
