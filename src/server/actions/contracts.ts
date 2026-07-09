// 목표 경로: src/server/actions/contracts.ts
//
// 계약서 — 작성/수정/서명(사인)/삭제.
// 서명: 태블릿에서 서명자 이름 + 캔버스 사인(PNG data URL)을 저장하며 status→SIGNED.
// 권한: 작성/수정/서명 = 해당 거래처 접근 가능자, 삭제 = 관리자 이상 또는 작성자.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role, WorkCategory } from "@/domain/types";
import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";
import type { CurrentUser } from "@/server/session";

async function assertClient(user: CurrentUser, clientId: string, assignedMarketerId: string | null) {
  const scopes = await getAdminScopes(user);
  assertCanAccessClient(user, clientId, scopes, assignedMarketerId);
}

const optionalDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null));

const createSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  amount: z.coerce.number().nonnegative().optional().nullable(),
  startDate: optionalDate,
  endDate: optionalDate
});

export async function createContract(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const client = await db.client.findUnique({ where: { id: d.clientId } });
    if (!client) throw new Error("NOT_FOUND");
    await assertClient(user, d.clientId, client.assignedMarketerId);

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          clientId: d.clientId,
          authorId: user.id,
          title: d.title,
          body: d.body,
          amount: d.amount ?? null,
          startDate: d.startDate,
          endDate: d.endDate,
          status: "DRAFT"
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "contract.create", targetType: "Contract", targetId: contract.id, afterState: { title: contract.title, clientId: contract.clientId }, ...meta });
      return contract;
    });
    revalidatePath("/contracts");
    return { id: saved.id };
  });
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  amount: z.coerce.number().nonnegative().optional().nullable(),
  startDate: optionalDate,
  endDate: optionalDate
});

export async function updateContract(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = updateSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const existing = await db.contract.findUnique({ where: { id: d.id }, include: { client: { select: { assignedMarketerId: true } } } });
    if (!existing) throw new Error("NOT_FOUND");
    await assertClient(user, existing.clientId, existing.client.assignedMarketerId);
    if (existing.status === "SIGNED") throw new Error("ALREADY_SIGNED");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: d.id },
        data: { title: d.title, body: d.body, amount: d.amount ?? null, startDate: d.startDate, endDate: d.endDate }
      });
      await recordAudit(tx, { actorId: user.id, action: "contract.update", targetType: "Contract", targetId: d.id, afterState: { title: d.title }, ...meta });
    });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${d.id}`);
  });
}

const signSchema = z.object({
  id: z.string().min(1),
  signerName: z.string().trim().min(1).max(100),
  signerTitle: z.string().trim().max(100).optional().nullable(),
  // PNG data URL (base64). 과대 입력 방지용 상한.
  signatureData: z
    .string()
    .min(1)
    .max(3_000_000)
    .refine((v) => v.startsWith("data:image/"), "서명 이미지 형식이 아닙니다.")
});

// 상품 → 업무 카테고리(enum) 매핑. 계약 확정 시 상품별 업무를 자동 생성한다.
function productToWorkCategory(name: string, category: string): WorkCategory {
  if (name.includes("영수증")) return WorkCategory.RECEIPT_REVIEW;
  if (name.includes("상위노출")) return WorkCategory.BLOG_SEO;
  switch (category) {
    case "블로그":
      return name.includes("배포") || name.includes("인플루언서") ? WorkCategory.BLOG_DISTRIBUTION : WorkCategory.BRAND_BLOG;
    case "SNS":
      return WorkCategory.SNS_MANAGEMENT;
    case "플레이스":
      return WorkCategory.PLACE_RANKING;
    default:
      // 검색광고·기타광고·웹·오프라인 → 운영
      return WorkCategory.ACCOUNT_MANAGEMENT;
  }
}

export async function signContract(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = signSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const existing = await db.contract.findUnique({
      where: { id: d.id },
      include: {
        client: { select: { assignedMarketerId: true } },
        products: { include: { product: { select: { name: true, category: true } } } }
      }
    });
    if (!existing) throw new Error("NOT_FOUND");
    await assertClient(user, existing.clientId, existing.client.assignedMarketerId);

    // 확정으로 전이할 때만 업무 자동 생성(중복 방지). 담당자 미배정 시 서명자=user가 소유.
    const generateWork = existing.status !== "SIGNED" && existing.products.length > 0;
    const ownerId = existing.client.assignedMarketerId ?? user.id;
    const dueDate = existing.startDate ?? new Date();

    const meta = await requestMeta();
    const created = await db.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: d.id },
        data: {
          signerName: d.signerName,
          signerTitle: d.signerTitle || null,
          signatureData: d.signatureData,
          status: "SIGNED",
          signedAt: new Date()
        }
      });

      let generatedCount = 0;
      if (generateWork) {
        for (const cp of existing.products) {
          await tx.workItem.create({
            data: {
              clientId: existing.clientId,
              ownerId,
              createdById: user.id,
              title: cp.product.name,
              category: productToWorkCategory(cp.product.name, cp.product.category),
              status: "NOT_STARTED",
              dueDate,
              progressNotes: `계약 "${existing.title}" 확정으로 자동 생성`
            }
          });
          generatedCount++;
        }
      }

      await recordAudit(tx, {
        actorId: user.id,
        action: "contract.sign",
        targetType: "Contract",
        targetId: d.id,
        afterState: { signerName: d.signerName, generatedWorkItems: generatedCount },
        ...meta
      });
      return generatedCount;
    });

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${d.id}`);
    if (created > 0) revalidatePath("/work");
  });
}

export async function deleteContract(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.contract.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
    if (!isManager && existing.authorId !== user.id) throw new Error("FORBIDDEN");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contract.delete({ where: { id: p.data.id } });
      await recordAudit(tx, { actorId: user.id, action: "contract.delete", targetType: "Contract", targetId: p.data.id, beforeState: { title: existing.title }, ...meta });
    });
    revalidatePath("/contracts");
  });
}
