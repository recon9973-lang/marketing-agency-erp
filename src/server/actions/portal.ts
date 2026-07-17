"use server";
// src/server/actions/portal.ts
// 클라이언트 포털 전용 서버 액션

import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────
// 내부 헬퍼: 포털 세션 검증 + clientId 반환
// ─────────────────────────────────────────────────
async function getPortalSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const user = await db.user.findUnique({
    where: { id: session.user.id! },
    select: { id: true, name: true, role: true, clientId: true },
  });

  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.role !== "CLIENT") throw new Error("FORBIDDEN");
  if (!user.clientId) throw new Error("CLIENT_NOT_LINKED");

  return { userId: user.id, clientId: user.clientId };
}

// ─────────────────────────────────────────────────
// 1. 요청 생성
// ─────────────────────────────────────────────────
export async function createClientRequest(input: {
  category: string;
  title: string;
  body: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { userId, clientId } = await getPortalSession();

    if (!input.title.trim() || !input.body.trim()) {
      return { ok: false, error: "제목과 내용은 필수입니다." };
    }

    const req = await db.clientRequest.create({
      data: {
        clientId,
        authorId: userId,
        category: input.category as never,
        title: input.title.trim(),
        body: input.body.trim(),
      },
      select: { id: true },
    });

    revalidatePath("/portal/requests");
    return { ok: true, id: req.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHENTICATED") return { ok: false, error: "로그인이 필요합니다." };
    if (msg === "FORBIDDEN") return { ok: false, error: "권한이 없습니다." };
    if (msg === "CLIENT_NOT_LINKED") return { ok: false, error: "계정이 거래처에 연결되지 않았습니다." };
    return { ok: false, error: "요청 생성에 실패했습니다." };
  }
}

// ─────────────────────────────────────────────────
// 2. 댓글 작성 (보고서 또는 요청에)
// ─────────────────────────────────────────────────
export async function addPortalComment(input: {
  body: string;
  reportId?: string;
  requestId?: string;
}): Promise<{
  ok: boolean;
  comment?: { id: string; body: string; createdAt: string };
  error?: string;
}> {
  try {
    const { userId, clientId } = await getPortalSession();

    if (!input.body.trim()) return { ok: false, error: "내용을 입력하세요." };
    if (!input.reportId && !input.requestId) {
      return { ok: false, error: "댓글 대상이 없습니다." };
    }

    // 접근 제어: 보고서는 자기 거래처 것인지 확인
    if (input.reportId) {
      const report = await db.report.findUnique({
        where: { id: input.reportId },
        select: { clientId: true },
      });
      if (!report || report.clientId !== clientId) {
        return { ok: false, error: "접근 권한이 없습니다." };
      }
    }

    // 접근 제어: 요청도 자기 거래처 것인지 확인
    if (input.requestId) {
      const req = await db.clientRequest.findUnique({
        where: { id: input.requestId },
        select: { clientId: true },
      });
      if (!req || req.clientId !== clientId) {
        return { ok: false, error: "접근 권한이 없습니다." };
      }
    }

    const comment = await db.clientComment.create({
      data: {
        authorId: userId,
        clientId,
        body: input.body.trim(),
        reportId: input.reportId,
        requestId: input.requestId,
      },
      select: { id: true, body: true, createdAt: true },
    });

    if (input.reportId) revalidatePath(`/portal/reports/${input.reportId}`);
    if (input.requestId) revalidatePath(`/portal/requests/${input.requestId}`);

    return {
      ok: true,
      comment: {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "UNAUTHENTICATED") return { ok: false, error: "로그인이 필요합니다." };
    if (msg === "FORBIDDEN") return { ok: false, error: "권한이 없습니다." };
    return { ok: false, error: "댓글 작성에 실패했습니다." };
  }
}

// ─────────────────────────────────────────────────
// 3. 파일 업로드 메타데이터 저장
//    (실제 파일은 Supabase Storage로 클라이언트에서 직접 업로드 후 URL 전달)
// ─────────────────────────────────────────────────
export async function savePortalAttachment(input: {
  fileName: string;
  fileUrl: string;
  fileSizeBytes?: number;
  mimeType?: string;
  requestId?: string;
  reportId?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const { userId, clientId } = await getPortalSession();

    const att = await db.clientAttachment.create({
      data: {
        clientId,
        uploaderId: userId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        requestId: input.requestId,
        reportId: input.reportId,
      },
      select: { id: true },
    });

    revalidatePath("/portal/files");
    if (input.requestId) revalidatePath(`/portal/requests/${input.requestId}`);

    return { ok: true, id: att.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "FORBIDDEN") return { ok: false, error: "권한이 없습니다." };
    return { ok: false, error: "파일 저장에 실패했습니다." };
  }
}

// ─────────────────────────────────────────────────
// 4. 내 보고서 목록 (서버 액션 버전 — RSC에서는 직접 DB 쿼리 권장)
// ─────────────────────────────────────────────────
export async function getMyReports() {
  const { clientId } = await getPortalSession();
  return db.report.findMany({
    where: { clientId },
    orderBy: { reportingMonth: "desc" },
    select: {
      id: true,
      title: true,
      reportingMonth: true,
      status: true,
      deliveredAt: true,
    },
  });
}
