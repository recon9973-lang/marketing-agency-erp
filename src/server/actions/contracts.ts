// 목표 경로: src/server/actions/contracts.ts
//
// 계약서 — 작성/수정/서명(사인)/삭제.
// 서명: 태블릿에서 서명자 이름 + 캔버스 사인(PNG data URL)을 저장하며 status→SIGNED.
// 권한: 작성/수정/서명 = 해당 거래처 접근 가능자, 삭제 = 관리자 이상 또는 작성자.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { Role, WorkCategory } from "@/domain/types";
import { assertCanAccessClient } from "@/domain/access-control";
import { contractBodyText, type ContractDetails } from "@/domain/contract";
import { getDefaultOrgId } from "@/server/org";
import { checkGuaranteeClaims, NON_GUARANTEE_DISCLAIMER } from "@/server/compliance/medical-law";
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

const detailsSchema = z
  .object({
    clientAddress: z.string().trim().max(300).optional(),
    clientBizNo: z.string().trim().max(50).optional(),
    clientCeo: z.string().trim().max(100).optional(),
    scopeItems: z.array(z.object({
      label: z.string().trim().min(1).max(100),
      group: z.enum(["online", "offline", "etc"]),
      qty: z.coerce.number().int().min(1).max(9999)
    })).max(60).optional(),
    scopeOnline: z.array(z.string().trim().max(80)).max(30).optional(),
    scopeOffline: z.array(z.string().trim().max(80)).max(30).optional(),
    vatIncluded: z.boolean().optional(),
    payTerms: z.string().trim().max(2000).optional(),
    autoRenew: z.boolean().optional(),
    special: z.string().trim().max(3000).optional()
  })
  .optional()
  .nullable();

const createSchema = z
  .object({
    // 순서 개선: 기존 거래처 선택(clientId) 또는 신규 거래처명(clientName)으로 계약 작성 →
    // clientId 없으면 계약 생성 시 거래처를 자동 생성한다.
    clientId: z.string().trim().optional().nullable(),
    clientName: z.string().trim().max(200).optional().nullable(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().optional().nullable(),
    details: detailsSchema,
    amount: z.coerce.number().nonnegative().optional().nullable(),
    startDate: optionalDate,
    endDate: optionalDate
  })
  .refine((v) => Boolean(v.clientId) || Boolean(v.clientName?.trim()), "거래처를 선택하거나 거래처명을 입력하세요.");

/** 거래처 코드 자동 생성 — VC-0001 순번(clients.ts와 동일 규칙). */
async function nextClientCode(): Promise<string> {
  const last = await db.client.findFirst({ where: { code: { startsWith: "VC-" } }, orderBy: { code: "desc" }, select: { code: true } });
  const lastNum = last?.code ? Number.parseInt(last.code.slice(3), 10) : 0;
  const next = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  return `VC-${String(next).padStart(4, "0")}`;
}

/** 계약 폼 데이터로 신규 거래처 생성 — code 충돌 시 재시도. 담당자=MARKETER면 본인 배정. */
async function createClientForContract(
  user: CurrentUser,
  name: string,
  details: ContractDetails | null | undefined,
  dates: { startDate: Date | null; endDate: Date | null },
  amount: number | null
): Promise<string> {
  const orgId = await getDefaultOrgId();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const client = await db.client.create({
        data: {
          name,
          code: await nextClientCode(),
          orgId,
          businessNumber: details?.clientBizNo || null,
          contactName: details?.clientCeo || null,
          region: details?.clientAddress || null,
          contractStartDate: dates.startDate,
          contractEndDate: dates.endDate,
          monthlyContractFee: amount ?? null,
          assignedMarketerId: user.role === Role.MARKETER ? user.id : null
        },
        select: { id: true }
      });
      return client.id;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002" && attempt < 4) continue; // code 충돌 → 재시도
      throw error;
    }
  }
  throw new Error("VALIDATION");
}

// body가 없으면 구조화 details로 평문 본문 생성(저장·검색·레거시용).
function resolveBody(args: { body?: string | null; details?: ContractDetails | null; clientName: string; amount: number | null; startDate: Date | null; endDate: Date | null }): string {
  const raw = args.body?.trim();
  if (raw) return raw;
  if (args.details) return contractBodyText({ clientName: args.clientName, amount: args.amount, startDate: args.startDate, endDate: args.endDate, details: args.details });
  return "";
}

export async function createContract(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    // 거래처: 기존 선택(clientId) 또는 신규 거래처명(clientName)으로 자동 생성.
    let clientId: string;
    let clientName: string;
    if (d.clientId) {
      const client = await db.client.findUnique({ where: { id: d.clientId } });
      if (!client) throw new Error("NOT_FOUND");
      await assertClient(user, d.clientId, client.assignedMarketerId);
      clientId = d.clientId;
      clientName = client.name;
    } else {
      clientName = (d.clientName ?? "").trim();
      if (!clientName) throw new Error("VALIDATION");
      clientId = await createClientForContract(user, clientName, d.details, { startDate: d.startDate, endDate: d.endDate }, d.amount ?? null);
    }

    const rawBody = resolveBody({ body: d.body, details: d.details, clientName, amount: d.amount ?? null, startDate: d.startDate, endDate: d.endDate });
    if (!rawBody) throw new Error("VALIDATION");
    // 성과 미보장 고지 자동 삽입(기획서 §9) + 보장성 문구 감지 결과를 감사로그에 기록
    const body = rawBody.includes("[성과 미보장 고지]") ? rawBody : `${rawBody}\n\n${NON_GUARANTEE_DISCLAIMER}`;
    const guaranteeFlags = checkGuaranteeClaims(rawBody).flags.map((f) => f.matched);

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          clientId,
          authorId: user.id,
          title: d.title,
          body,
          details: d.details ?? undefined,
          amount: d.amount ?? null,
          startDate: d.startDate,
          endDate: d.endDate,
          status: "DRAFT"
        }
      });
      await recordAudit(tx, { actorId: user.id, action: "contract.create", targetType: "Contract", targetId: contract.id, afterState: { title: contract.title, clientId: contract.clientId, guaranteeClaimWarnings: guaranteeFlags }, ...meta });
      return contract;
    });
    revalidatePath("/contracts");
    revalidatePath("/clients"); // 신규 거래처 자동 생성 반영
    return { id: saved.id };
  });
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().optional().nullable(),
  details: detailsSchema,
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
    const existing = await db.contract.findUnique({ where: { id: d.id }, include: { client: { select: { name: true, assignedMarketerId: true } } } });
    if (!existing) throw new Error("NOT_FOUND");
    await assertClient(user, existing.clientId, existing.client.assignedMarketerId);
    if (existing.status === "SIGNED") throw new Error("ALREADY_SIGNED");

    const rawBody = resolveBody({ body: d.body, details: d.details, clientName: existing.client.name, amount: d.amount ?? null, startDate: d.startDate, endDate: d.endDate });
    if (!rawBody) throw new Error("VALIDATION");
    const body = rawBody.includes("[성과 미보장 고지]") ? rawBody : `${rawBody}\n\n${NON_GUARANTEE_DISCLAIMER}`;

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: d.id },
        data: { title: d.title, body, details: d.details ?? undefined, amount: d.amount ?? null, startDate: d.startDate, endDate: d.endDate }
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

// Product.defaultTasks(Json) 항목 스키마 — 형식이 어긋나도 계약 서명이 죽지 않도록
// safeParse 후 실패 항목은 버리고, category 불일치는 productToWorkCategory로 폴백한다.
// (서명은 태블릿 앞 실사용 흐름 — 여기서 실패하면 안 된다. 패널 결정 #4b)
const defaultTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().optional(),
  offsetDays: z.coerce.number().int().min(-365).max(730).default(0),
  offsetFrom: z.enum(["START", "END"]).default("START"),
  checklist: z.array(z.string().trim().min(1).max(200)).max(30).optional()
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** 템플릿 마감일 계산 — END 앵커인데 종료일이 없으면 시작일+365일로 대체(업무 누락 방지). */
function templateDueDate(
  t: { offsetDays: number; offsetFrom: "START" | "END" },
  startDate: Date,
  endDate: Date | null
): Date {
  const anchor = t.offsetFrom === "END" ? endDate ?? new Date(startDate.getTime() + 365 * DAY_MS) : startDate;
  return new Date(anchor.getTime() + t.offsetDays * DAY_MS);
}

/** Json defaultTasks → 검증된 WorkItem 생성 데이터. 유효 항목이 없으면 null(폴백 신호). */
function parseDefaultTasks(
  raw: unknown,
  productName: string,
  productCategory: string,
  base: { clientId: string; ownerId: string; createdById: string; startDate: Date; endDate: Date | null; contractTitle: string }
): Array<{
  clientId: string;
  ownerId: string;
  createdById: string;
  title: string;
  category: WorkCategory;
  status: "NOT_STARTED";
  dueDate: Date;
  progressNotes: string;
}> | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const workCategories = new Set<string>(Object.values(WorkCategory));
  const rows = [];
  for (const item of raw) {
    const p = defaultTaskSchema.safeParse(item);
    if (!p.success) continue; // 깨진 항목은 서명을 막지 않고 건너뜀
    const t = p.data;
    const category = workCategories.has(t.category ?? "")
      ? (t.category as WorkCategory)
      : productToWorkCategory(productName, productCategory);
    const checklistNote = t.checklist?.length ? `\n체크리스트: ${t.checklist.join(", ")}` : "";
    rows.push({
      clientId: base.clientId,
      ownerId: base.ownerId,
      createdById: base.createdById,
      title: t.title,
      category,
      status: "NOT_STARTED" as const,
      dueDate: templateDueDate(t, base.startDate, base.endDate),
      progressNotes: `계약 "${base.contractTitle}" 확정으로 자동 생성 (${productName})${checklistNote}`
    });
  }
  return rows.length > 0 ? rows : null;
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
        products: { include: { product: { select: { name: true, category: true, defaultTasks: true } } } }
      }
    });
    if (!existing) throw new Error("NOT_FOUND");
    await assertClient(user, existing.clientId, existing.client.assignedMarketerId);

    // 확정으로 전이할 때만 업무 자동 생성(중복 방지). 담당자 미배정 시 서명자=user가 소유.
    const generateWork = existing.status !== "SIGNED" && existing.products.length > 0;
    const ownerId = existing.client.assignedMarketerId ?? user.id;
    const startDate = existing.startDate ?? new Date();
    const endDate = existing.endDate ?? null;

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
          // 상품에 defaultTasks 템플릿이 있으면 템플릿대로 벌크 생성(기획서 §11 온보딩 업무),
          // 없거나 전부 무효면 기존처럼 상품당 1개 폴백(하위호환).
          const templated = parseDefaultTasks(cp.product.defaultTasks, cp.product.name, cp.product.category, {
            clientId: existing.clientId,
            ownerId,
            createdById: user.id,
            startDate,
            endDate,
            contractTitle: existing.title
          });
          if (templated) {
            await tx.workItem.createMany({ data: templated });
            generatedCount += templated.length;
          } else {
            await tx.workItem.create({
              data: {
                clientId: existing.clientId,
                ownerId,
                createdById: user.id,
                title: cp.product.name,
                category: productToWorkCategory(cp.product.name, cp.product.category),
                status: "NOT_STARTED",
                dueDate: startDate,
                progressNotes: `계약 "${existing.title}" 확정으로 자동 생성`
              }
            });
            generatedCount++;
          }
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

/** 계약 확정 시 상품별 업무 자동 생성(원격 서명용 공용 헬퍼). */
async function generateWorkItems(
  tx: Prisma.TransactionClient,
  products: { product: { name: string; category: string; defaultTasks: unknown } }[],
  base: { clientId: string; ownerId: string; createdById: string; startDate: Date; endDate: Date | null; contractTitle: string }
): Promise<number> {
  let count = 0;
  for (const cp of products) {
    const templated = parseDefaultTasks(cp.product.defaultTasks, cp.product.name, cp.product.category, base);
    if (templated) {
      await tx.workItem.createMany({ data: templated });
      count += templated.length;
    } else {
      await tx.workItem.create({
        data: {
          clientId: base.clientId, ownerId: base.ownerId, createdById: base.createdById,
          title: cp.product.name, category: productToWorkCategory(cp.product.name, cp.product.category),
          status: "NOT_STARTED", dueDate: base.startDate,
          progressNotes: `계약 "${base.contractTitle}" 확정으로 자동 생성`
        }
      });
      count++;
    }
  }
  return count;
}

/** 원격 서명 링크 발급 — 계약 접근 가능자. token으로 /sign/{token} 링크를 만들어 고객에게 전달. */
export async function createSignLink(input: unknown): Promise<ActionResult<{ token: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1), regenerate: z.boolean().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.contract.findUnique({ where: { id: p.data.id }, include: { client: { select: { assignedMarketerId: true } } } });
    if (!existing) throw new Error("NOT_FOUND");
    await assertClient(user, existing.clientId, existing.client.assignedMarketerId);
    let token = existing.signToken;
    if (!token || p.data.regenerate) {
      token = randomBytes(24).toString("base64url");
      await db.contract.update({ where: { id: existing.id }, data: { signToken: token } });
    }
    revalidatePath(`/contracts/${existing.id}`);
    return { token };
  });
}

const signByTokenSchema = z.object({
  token: z.string().min(16),
  signerName: z.string().trim().min(1).max(100),
  signerTitle: z.string().trim().max(100).optional().nullable(),
  signatureData: z.string().min(1).max(3_000_000).refine((v) => v.startsWith("data:image/"), "서명 이미지 형식이 아닙니다.")
});

/** 원격 서명 — 인증 없이 signToken으로 검증해 고객이 자기 기기에서 서명한다. */
export async function signContractByToken(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const p = signByTokenSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const existing = await db.contract.findUnique({
      where: { signToken: d.token },
      include: {
        client: { select: { assignedMarketerId: true } },
        products: { include: { product: { select: { name: true, category: true, defaultTasks: true } } } }
      }
    });
    if (!existing) throw new Error("NOT_FOUND");
    if (existing.status === "SIGNED") throw new Error("ALREADY_SIGNED");

    const ownerId = existing.client.assignedMarketerId ?? existing.authorId;
    const startDate = existing.startDate ?? new Date();
    const endDate = existing.endDate ?? null;
    const meta = await requestMeta();
    const created = await db.$transaction(async (tx) => {
      await tx.contract.update({
        where: { id: existing.id },
        data: { signerName: d.signerName, signerTitle: d.signerTitle || null, signatureData: d.signatureData, status: "SIGNED", signedAt: new Date() }
      });
      const count = existing.products.length
        ? await generateWorkItems(tx, existing.products, { clientId: existing.clientId, ownerId, createdById: existing.authorId, startDate, endDate, contractTitle: existing.title })
        : 0;
      await recordAudit(tx, { actorId: existing.authorId, action: "contract.sign.remote", targetType: "Contract", targetId: existing.id, afterState: { signerName: d.signerName, generatedWorkItems: count }, ...meta });
      return count;
    });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${existing.id}`);
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
