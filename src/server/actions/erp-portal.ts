"use server";
// src/server/actions/erp-portal.ts
// ERP 내부 직원(마케터/관리자)이 포털 요청을 관리하는 서버 액션

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";

type InternalRole = "SUPER_ADMIN" | "ADMIN" | "MARKETER";

async function getErpSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const user = await db.user.findUnique({
    where: { id: session.user.id! },
    select: { id: true, role: true },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.role === "CLIENT") throw new Error("FORBIDDEN");

  return { userId: user.id, role: user.role as InternalRole };
}

// ─────────────────────────────────────────────────
// 1. 포털 요청 상태/담당자/답변 업데이트
// ─────────────────────────────────────────────────
export async function updatePortalRequest(input: {
  requestId: string;
  status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  adminNote?: string;
  assigneeId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, role } = await getErpSession();

    const req = await db.clientRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, clientId: true, assigneeId: true },
    });
    if (!req) return { ok: false, error: "요청을 찾을 수 없습니다." };

    // 마케터는 자신이 담당한 거래처 요청만 수정 가능
    if (role === "MARKETER") {
      const client = await db.client.findUnique({
        where: { id: req.clientId },
        select: { assignedMarketerId: true },
      });
      if (client?.assignedMarketerId !== userId) {
        return { ok: false, error: "담당 거래처 요청만 처리할 수 있습니다." };
      }
    }

    const data: Record<string, unknown> = {};
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === "RESOLVED") data.resolvedAt = new Date();
      if (input.status === "CLOSED") data.closedAt = new Date();
    }
    if (input.adminNote !== undefined) data.adminNote = input.adminNote;
    if ("assigneeId" in input) data.assigneeId = input.assigneeId;

    await db.clientRequest.update({
      where: { id: input.requestId },
      data,
    });

    revalidatePath("/portal-requests");
    revalidatePath(`/portal-requests/${input.requestId}`);
    // 포털 측 캐시도 갱신
    revalidatePath(`/portal/requests/${input.requestId}`);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHENTICATED") return { ok: false, error: "로그인이 필요합니다." };
    if (msg === "FORBIDDEN") return { ok: false, error: "권한이 없습니다." };
    return { ok: false, error: "업데이트에 실패했습니다." };
  }
}

// ─────────────────────────────────────────────────
// 2. 거래처 영업 파이프라인 상태 변경
// ─────────────────────────────────────────────────
export async function updateClientPipelineStatus(input: {
  clientId: string;
  status: string;
  note?: string;
  stageAssigneeId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { userId, role } = await getErpSession();
    if (role === "MARKETER") return { ok: false, error: "관리자 권한이 필요합니다." };

    const client = await db.client.findUnique({
      where: { id: input.clientId },
      select: { id: true, status: true, statusHistory: true },
    });
    if (!client) return { ok: false, error: "거래처를 찾을 수 없습니다." };

    const history = Array.isArray(client.statusHistory) ? client.statusHistory : [];
    const newHistory = [
      ...history,
      {
        status: input.status,
        changedAt: new Date().toISOString(),
        changedBy: userId,
        note: input.note ?? null,
      },
    ];

    const data: Record<string, unknown> = {
      status: input.status,
      statusHistory: newHistory,
    };
    if ("stageAssigneeId" in input) data.stageAssigneeId = input.stageAssigneeId;

    await db.client.update({ where: { id: input.clientId }, data });

    revalidatePath("/clients/pipeline");
    revalidatePath(`/clients/${input.clientId}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHENTICATED") return { ok: false, error: "로그인이 필요합니다." };
    return { ok: false, error: "상태 변경에 실패했습니다." };
  }
}

// ─────────────────────────────────────────────────
// 3. ERP 내부 댓글 추가 (포털 ClientComment 공유)
// ─────────────────────────────────────────────────
export async function addErpComment(input: {
  body: string;
  requestId?: string;
  reportId?: string;
  clientId: string;
}): Promise<{
  ok: boolean;
  comment?: { id: string; body: string; createdAt: string };
  error?: string;
}> {
  try {
    const { userId } = await getErpSession();
    if (!input.body.trim()) return { ok: false, error: "내용을 입력하세요." };

    const comment = await db.clientComment.create({
      data: {
        authorId: userId,
        clientId: input.clientId,
        body: input.body.trim(),
        requestId: input.requestId,
        reportId: input.reportId,
      },
      select: { id: true, body: true, createdAt: true },
    });

    if (input.requestId) {
      revalidatePath(`/portal-requests/${input.requestId}`);
      revalidatePath(`/portal/requests/${input.requestId}`);
    }
    if (input.reportId) {
      revalidatePath(`/portal/reports/${input.reportId}`);
    }

    return {
      ok: true,
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, error: "댓글 작성에 실패했습니다." };
  }
}
