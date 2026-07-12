// 목표 경로: src/server/actions/leads.ts
//
// 영업 리드(CRM) — 등록/수정/상태전이/무료진단 저장/거래처 전환/삭제.
// 규칙(기획서 §5-1~4, §12, §15):
//  - 연락처를 수집하는 등록은 개인정보 동의 필수(consentAt + 고지문 버전 기록, §15 방어)
//  - 상태 전이는 domain/sales/lead-stages.ts 전이표를 따름 (AE 본인·관리자만 변경)
//  - WON은 터미널 — convertLeadToClient로만 도달(거래처+병원프로필 생성과 원자적으로)
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Role } from "@/domain/types";
import {
  canTransitionLead,
  computeAuditScore,
  isLeadStatus,
  LEAD_CONSENT_TEXT_VERSION,
  type AuditChecklist
} from "@/domain/sales/lead-stages";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import {
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";
import type { CurrentUser } from "@/server/session";

/** 리드 접근: 관리자 이상 전체, MARKETER는 본인 배정(또는 미배정) 리드만. */
function assertLeadAccess(user: CurrentUser, assigneeId: string | null) {
  if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return;
  if (assigneeId && assigneeId !== user.id) throw new Error("FORBIDDEN");
}

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => v || null);

const createSchema = z.object({
  hospitalName: z.string().trim().min(1).max(200),
  department: optionalText,
  region: optionalText,
  source: optionalText,
  contactName: optionalText,
  contactPhone: optionalText,
  contactEmail: z.string().trim().email().optional().nullable().or(z.literal("")).transform((v) => v || null),
  websiteUrl: optionalText,
  placeUrl: optionalText,
  adBudgetEstimate: z.coerce.number().nonnegative().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
  grade: z.enum(["A", "B", "C"]).optional().nullable(),
  assigneeId: optionalText,
  nextActionAt: z.coerce.date().optional().nullable(),
  consent: z.boolean()
});

export async function createLead(input: unknown): Promise<ActionResult<{ id: string; duplicates: string[] }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = createSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;

    // 연락처(이름·전화·이메일)를 수집하면 동의가 필수(개인정보보호법 §15)
    const collectsPersonalInfo = Boolean(d.contactName || d.contactPhone || d.contactEmail);
    if (collectsPersonalInfo && !d.consent) throw new Error("CONSENT_REQUIRED");

    // 중복 소프트체크 — 병원명+지역 또는 URL 일치 후보를 반환(차단하지 않음, 기획서 §5-1 병합 대기)
    const dupWhere = [];
    if (d.websiteUrl) dupWhere.push({ websiteUrl: d.websiteUrl });
    if (d.placeUrl) dupWhere.push({ placeUrl: d.placeUrl });
    dupWhere.push({ hospitalName: d.hospitalName, region: d.region ?? undefined });
    const dups = await db.lead.findMany({
      where: { OR: dupWhere },
      select: { id: true, hospitalName: true, region: true },
      take: 5
    });

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          hospitalName: d.hospitalName,
          department: d.department,
          region: d.region,
          source: d.source,
          contactName: d.contactName,
          contactPhone: d.contactPhone,
          contactEmail: d.contactEmail,
          websiteUrl: d.websiteUrl,
          placeUrl: d.placeUrl,
          adBudgetEstimate: d.adBudgetEstimate ?? null,
          note: d.note,
          grade: d.grade ?? null,
          assigneeId: d.assigneeId || (user.role === Role.MARKETER ? user.id : null),
          nextActionAt: d.nextActionAt ?? null,
          consentAt: d.consent ? new Date() : null,
          consentTextVersion: d.consent ? LEAD_CONSENT_TEXT_VERSION : null,
          orgId
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "lead.create",
        targetType: "Lead",
        targetId: lead.id,
        afterState: { hospitalName: lead.hospitalName, status: lead.status, duplicateCandidates: dups.length },
        ...meta
      });
      return lead;
    });

    revalidatePath("/leads");
    return { id: created.id, duplicates: dups.map((x) => `${x.hospitalName}${x.region ? ` (${x.region})` : ""}`) };
  });
}

const updateSchema = createSchema.partial().omit({ consent: true }).extend({
  id: z.string().min(1),
  lostReason: z.string().trim().max(500).optional().nullable().transform((v) => v || null)
});

export async function updateLead(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = updateSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const { id, ...d } = p.data;
    const existing = await db.lead.findUnique({ where: { id } });
    if (!existing) throw new Error("NOT_FOUND");
    assertLeadAccess(user, existing.assigneeId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          ...(d.hospitalName !== undefined ? { hospitalName: d.hospitalName } : {}),
          ...(d.department !== undefined ? { department: d.department } : {}),
          ...(d.region !== undefined ? { region: d.region } : {}),
          ...(d.source !== undefined ? { source: d.source } : {}),
          ...(d.contactName !== undefined ? { contactName: d.contactName } : {}),
          ...(d.contactPhone !== undefined ? { contactPhone: d.contactPhone } : {}),
          ...(d.contactEmail !== undefined ? { contactEmail: d.contactEmail } : {}),
          ...(d.websiteUrl !== undefined ? { websiteUrl: d.websiteUrl } : {}),
          ...(d.placeUrl !== undefined ? { placeUrl: d.placeUrl } : {}),
          ...(d.adBudgetEstimate !== undefined ? { adBudgetEstimate: d.adBudgetEstimate } : {}),
          ...(d.note !== undefined ? { note: d.note } : {}),
          ...(d.grade !== undefined ? { grade: d.grade } : {}),
          ...(d.assigneeId !== undefined ? { assigneeId: d.assigneeId } : {}),
          ...(d.nextActionAt !== undefined ? { nextActionAt: d.nextActionAt } : {}),
          ...(d.lostReason !== undefined ? { lostReason: d.lostReason } : {})
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "lead.update",
        targetType: "Lead",
        targetId: id,
        beforeState: { status: existing.status },
        ...meta
      });
    });
    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
  });
}

const transitionSchema = z.object({
  id: z.string().min(1),
  to: z.string().min(1),
  lostReason: z.string().trim().max(500).optional().nullable(),
  nextActionAt: z.coerce.date().optional().nullable()
});

export async function transitionLead(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = transitionSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    if (!isLeadStatus(d.to)) throw new Error("VALIDATION");
    const existing = await db.lead.findUnique({ where: { id: d.id } });
    if (!existing) throw new Error("NOT_FOUND");
    assertLeadAccess(user, existing.assigneeId);

    if (!isLeadStatus(existing.status) || !canTransitionLead(existing.status, d.to)) {
      throw new Error("ILLEGAL_TRANSITION");
    }

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: d.id },
        data: {
          status: d.to,
          ...(d.to === "LOST" ? { lostReason: d.lostReason || null } : {}),
          ...(d.to === "RECONTACT"
            ? { nextActionAt: d.nextActionAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
            : {}),
          ...(d.nextActionAt && d.to !== "RECONTACT" ? { nextActionAt: d.nextActionAt } : {})
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "lead.transition",
        targetType: "Lead",
        targetId: d.id,
        beforeState: { status: existing.status },
        afterState: { status: d.to },
        ...meta
      });
    });
    revalidatePath("/leads");
    revalidatePath(`/leads/${d.id}`);
  });
}

const auditSchema = z.object({
  id: z.string().min(1),
  checklist: z.record(z.string(), z.boolean()),
  auditNote: z.string().trim().max(4000).optional().nullable().transform((v) => v || null)
});

/** 무료진단 체크리스트 저장 — 점수는 서버에서 자동 산정(§11 초기진단). */
export async function saveLeadAudit(input: unknown): Promise<ActionResult<{ score: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = auditSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const existing = await db.lead.findUnique({ where: { id: d.id } });
    if (!existing) throw new Error("NOT_FOUND");
    assertLeadAccess(user, existing.assigneeId);

    const score = computeAuditScore(d.checklist as AuditChecklist);
    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: d.id },
        data: { auditChecklist: d.checklist, auditScore: score, auditNote: d.auditNote }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "lead.audit.save",
        targetType: "Lead",
        targetId: d.id,
        afterState: { score },
        ...meta
      });
    });
    revalidatePath(`/leads/${d.id}`);
    return { score };
  });
}

/** 거래처 코드 자동 생성 — clients.ts와 동일 규칙(VC-0001 순번). */
async function nextClientCode(): Promise<string> {
  const last = await db.client.findFirst({
    where: { code: { startsWith: "VC-" } },
    orderBy: { code: "desc" },
    select: { code: true }
  });
  const lastNum = last?.code ? Number.parseInt(last.code.slice(3), 10) : 0;
  const next = Number.isFinite(lastNum) ? lastNum + 1 : 1;
  return `VC-${String(next).padStart(4, "0")}`;
}

const convertSchema = z.object({ id: z.string().min(1) });

/**
 * 계약 성사 — 리드를 거래처로 전환(원자적).
 * Client + HospitalProfile 생성 → lead.status=WON + clientId 링크. PROPOSAL 상태에서만 허용.
 */
export async function convertLeadToClient(input: unknown): Promise<ActionResult<{ clientId: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = convertSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.lead.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    assertLeadAccess(user, existing.assigneeId);
    if (existing.clientId) throw new Error("ALREADY_CONVERTED");
    if (!isLeadStatus(existing.status) || !canTransitionLead(existing.status, "WON")) {
      throw new Error("ILLEGAL_TRANSITION");
    }

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();

    // code unique 경합 시 재시도(clients.ts와 동일 패턴)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await nextClientCode();
      try {
        const clientId = await db.$transaction(async (tx) => {
          // 리드에서 아는 정보(URL·메모)를 서비스 노트로, 지역은 전용 필드로 이관(이중 입력 제거)
          const notes = [
            existing.websiteUrl ? `홈페이지: ${existing.websiteUrl}` : null,
            existing.placeUrl ? `플레이스: ${existing.placeUrl}` : null,
            existing.note
          ]
            .filter(Boolean)
            .join("\n");
          const client = await tx.client.create({
            data: {
              name: existing.hospitalName,
              code,
              orgId,
              region: existing.region,
              contactName: existing.contactName,
              contactEmail: existing.contactEmail,
              contactPhone: existing.contactPhone,
              serviceNotes: notes || null,
              assignedMarketerId: existing.assigneeId
            }
          });
          // 병원 프로필 — 진료과 복사(기준데이터의 시작점)
          await tx.hospitalProfile.create({
            data: {
              clientId: client.id,
              departments: existing.department,
              orgId
            }
          });
          await tx.lead.update({
            where: { id: existing.id },
            data: { status: "WON", clientId: client.id }
          });
          // 리드 단계 견적을 거래처로 링크 — 제안서·계약서 문구 일치 추적(워크플로우 02 게이트)
          await tx.quote.updateMany({
            where: { leadId: existing.id, clientId: null },
            data: { clientId: client.id }
          });
          await recordAudit(tx, {
            actorId: user.id,
            action: "lead.convert",
            targetType: "Lead",
            targetId: existing.id,
            afterState: { clientId: client.id, code },
            ...meta
          });
          return client.id;
        });
        revalidatePath("/leads");
        revalidatePath(`/leads/${existing.id}`);
        revalidatePath("/clients");
        return { clientId };
      } catch (error) {
        if ((error as { code?: string })?.code === "P2002" && attempt < 4) continue;
        throw error;
      }
    }
    throw new Error("CLIENT_CODE_CONFLICT");
  });
}

export async function deleteLead(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) throw new Error("FORBIDDEN");
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.lead.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.lead.delete({ where: { id: p.data.id } });
      await recordAudit(tx, {
        actorId: user.id,
        action: "lead.delete",
        targetType: "Lead",
        targetId: p.data.id,
        beforeState: { hospitalName: existing.hospitalName, status: existing.status },
        ...meta
      });
    });
    revalidatePath("/leads");
  });
}