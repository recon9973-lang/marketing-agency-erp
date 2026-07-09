// 목표 경로: src/server/actions/comments.ts
//
// 협업 댓글 — 대상(거래처/업무/보고서/계약)에 댓글을 달고, 본문의 @멘션을 감지해
// 해당 직원에게 알림(Notification)을 생성한다. 권한: 로그인 사용자 누구나.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import { db } from "@/server/db";
import { COMMENT_TARGETS } from "@/server/repositories/collab";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";

const createSchema = z.object({
  targetType: z.enum(COMMENT_TARGETS),
  targetId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  // 클릭이 어디서 왔는지(알림 링크 생성용). 없으면 대상 유형으로 추정.
  path: z.string().trim().max(300).optional().nullable()
});

const TARGET_LABEL: Record<string, string> = {
  CLIENT: "거래처",
  WORK: "업무",
  REPORT: "보고서",
  CONTRACT: "계약서"
};

function defaultLink(targetType: string, targetId: string): string {
  if (targetType === "CLIENT") return `/clients/${targetId}`;
  if (targetType === "CONTRACT") return `/contracts/${targetId}`;
  if (targetType === "REPORT") return `/reports`;
  return `/work`;
}

export async function createComment(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const link = d.path && d.path.startsWith("/") ? d.path : defaultLink(d.targetType, d.targetId);

    // 활성 직원 중 본문에 @이름이 포함된 사람을 멘션 대상으로(작성자 자신은 제외).
    const members = await db.user.findMany({
      where: { status: "ACTIVE", isActive: true },
      select: { id: true, name: true }
    });
    const mentioned = members.filter(
      (m) => m.id !== user.id && m.name.length > 0 && d.body.includes(`@${m.name}`)
    );

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { authorId: user.id, body: d.body, targetType: d.targetType, targetId: d.targetId }
      });
      if (mentioned.length > 0) {
        await tx.notification.createMany({
          data: mentioned.map((m) => ({
            userId: m.id,
            actorId: user.id,
            type: "MENTION",
            title: `${user.name}님이 회원님을 언급했습니다`,
            body: `[${TARGET_LABEL[d.targetType] ?? d.targetType}] ${d.body.slice(0, 80)}`,
            link,
            targetType: d.targetType,
            targetId: d.targetId
          }))
        });
      }
      await recordAudit(tx, {
        actorId: user.id,
        action: "comment.create",
        targetType: `Comment:${d.targetType}`,
        targetId: comment.id,
        afterState: { targetId: d.targetId, mentions: mentioned.length },
        ...meta
      });
      return comment;
    });

    revalidatePath(link);
    return { id: saved.id };
  });
}

export async function deleteComment(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1), path: z.string().optional().nullable() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.comment.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && existing.authorId !== user.id) throw new Error("FORBIDDEN");

    await db.comment.delete({ where: { id: p.data.id } });
    if (p.data.path && p.data.path.startsWith("/")) revalidatePath(p.data.path);
  });
}
