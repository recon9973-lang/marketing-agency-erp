// 목표 경로: src/server/actions/geo.ts
//
// GEO 모니터링 — 질문 후보 생성/일괄 승인/종료/답변 기록(upsert).
// 원칙(기획서 §5-7, §8): 질문·타깃페이지에 위험표현이 있으면 생성 차단,
// 승인은 배치 단위(개별 20건 승인 마찰 방지 — 패널 결정 #7),
// 답변 기록은 수동 실행 결과 + 캡처 링크(자동 스크래핑 배제).
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buildGeoQuestionCandidates, isGeoEngine } from "@/domain/sales/geo";
import { runGeoWatch } from "@/server/geo-engine/runner";
import { createAnswerPagePlan } from "@/server/geo-engine/answer-page";
import { assertCanAccessClient } from "@/domain/access-control";
import { db } from "@/server/db";
import { getDefaultOrgId } from "@/server/org";
import { checkMedicalLaw, checkGuaranteeClaims } from "@/server/compliance/medical-law";
import {
  getAdminScopes,
  recordAudit,
  requestMeta,
  requireUser,
  runAction,
  type ActionResult
} from "@/server/actions/_helpers";
import type { CurrentUser } from "@/server/session";

async function assertClient(user: CurrentUser, clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { assignedMarketerId: true } });
  if (!client) throw new Error("NOT_FOUND");
  const scopes = await getAdminScopes(user);
  assertCanAccessClient(user, clientId, scopes, client.assignedMarketerId);
}

const generateSchema = z.object({
  clientId: z.string().min(1),
  department: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(100)
});

/** 진료과·지역 기반 질문 후보 20개 생성(정적 템플릿). 이미 같은 질문이 있으면 건너뜀. */
export async function generateGeoCandidates(input: unknown): Promise<ActionResult<{ created: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = generateSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    await assertClient(user, d.clientId);

    const candidates = buildGeoQuestionCandidates(d.department, d.region);
    const existing = await db.geoQuestion.findMany({
      where: { clientId: d.clientId },
      select: { question: true }
    });
    const known = new Set(existing.map((q) => q.question));
    const fresh = candidates.filter((c) => !known.has(c.question));

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      if (fresh.length > 0) {
        await tx.geoQuestion.createMany({
          data: fresh.map((c) => ({
            clientId: d.clientId,
            department: d.department,
            question: c.question,
            qtype: c.type,
            priority: c.priority,
            status: "CANDIDATE",
            orgId
          }))
        });
      }
      await recordAudit(tx, {
        actorId: user.id,
        action: "geo.candidates.generate",
        targetType: "GeoQuestion",
        targetId: d.clientId,
        afterState: { department: d.department, region: d.region, created: fresh.length },
        ...meta
      });
      return fresh.length;
    });

    revalidatePath("/geo");
    return { created };
  });
}

const addQuestionSchema = z.object({
  clientId: z.string().min(1),
  question: z.string().trim().min(5).max(300),
  department: z.string().trim().max(100).optional().nullable(),
  qtype: z.enum(["정의형", "판단형", "비교형", "위험형", "지역형"]).optional().nullable(),
  targetPageUrl: z.string().trim().max(500).optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).default(3)
});

/** 질문 수동 추가 — 위험표현(의료법·보장성) 감지 시 차단. */
export async function addGeoQuestion(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = addQuestionSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    await assertClient(user, d.clientId);

    // 질문 텍스트에 보장·최상급 문구가 있으면 그대로 페이지 제작으로 흘러가므로 사전 차단
    const risk = checkMedicalLaw(d.question);
    const guarantee = checkGuaranteeClaims(d.question);
    if (risk.highCount > 0 || guarantee.highCount > 0) throw new Error("COMPLIANCE_BLOCKED");

    const meta = await requestMeta();
    const orgId = await getDefaultOrgId();
    const created = await db.$transaction(async (tx) => {
      const q = await tx.geoQuestion.create({
        data: {
          clientId: d.clientId,
          question: d.question,
          department: d.department || null,
          qtype: d.qtype || null,
          targetPageUrl: d.targetPageUrl || null,
          priority: d.priority,
          status: "CANDIDATE",
          orgId
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "geo.question.add",
        targetType: "GeoQuestion",
        targetId: q.id,
        afterState: { question: d.question },
        ...meta
      });
      return q;
    });
    revalidatePath("/geo");
    return { id: created.id };
  });
}

const approveSchema = z.object({
  clientId: z.string().min(1),
  questionIds: z.array(z.string().min(1)).min(1).max(100)
});

/** 질문 배치 승인 — 병원 확인 후 담당자가 일괄 승인 기록(approvedBy/At + 감사로그). */
export async function approveGeoQuestions(input: unknown): Promise<ActionResult<{ approved: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = approveSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    await assertClient(user, d.clientId);

    const meta = await requestMeta();
    const approved = await db.$transaction(async (tx) => {
      const result = await tx.geoQuestion.updateMany({
        where: { id: { in: d.questionIds }, clientId: d.clientId, status: "CANDIDATE" },
        data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "geo.questions.approve",
        targetType: "GeoQuestion",
        targetId: d.clientId,
        afterState: { approvedCount: result.count, questionIds: d.questionIds },
        ...meta
      });
      return result.count;
    });
    revalidatePath("/geo");
    return { approved };
  });
}

const retireSchema = z.object({ id: z.string().min(1) });

export async function retireGeoQuestion(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = retireSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.geoQuestion.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    await assertClient(user, existing.clientId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.geoQuestion.update({ where: { id: p.data.id }, data: { status: "RETIRED" } });
      await recordAudit(tx, {
        actorId: user.id,
        action: "geo.question.retire",
        targetType: "GeoQuestion",
        targetId: p.data.id,
        beforeState: { status: existing.status },
        ...meta
      });
    });
    revalidatePath("/geo");
  });
}

/** 종료 질문 복원 — RETIRED → CANDIDATE(재승인 필요, 오조작 복구용). */
export async function reactivateGeoQuestion(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = retireSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.geoQuestion.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    if (existing.status !== "RETIRED") throw new Error("ILLEGAL_TRANSITION");
    await assertClient(user, existing.clientId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.geoQuestion.update({
        where: { id: p.data.id },
        data: { status: "CANDIDATE", approvedAt: null, approvedById: null }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "geo.question.reactivate",
        targetType: "GeoQuestion",
        targetId: p.data.id,
        beforeState: { status: existing.status },
        ...meta
      });
    });
    revalidatePath("/geo");
  });
}

/** 질문 완전 삭제 — 종료(RETIRED) 상태에서만 허용(관측 이력 오삭제 방지). 데모 데이터 정리용. */
export async function deleteGeoQuestion(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = retireSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.geoQuestion.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    if (existing.status !== "RETIRED") throw new Error("ILLEGAL_TRANSITION");
    await assertClient(user, existing.clientId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      // DB에 FK가 없어 Prisma cascade가 동작하지 않으므로 관측 기록을 명시적으로 먼저 삭제
      await tx.geoAnswerRecord.deleteMany({ where: { questionId: p.data.id } });
      await tx.geoQuestion.delete({ where: { id: p.data.id } });
      await recordAudit(tx, {
        actorId: user.id,
        action: "geo.question.delete",
        targetType: "GeoQuestion",
        targetId: p.data.id,
        beforeState: { question: existing.question, status: existing.status },
        ...meta
      });
    });
    revalidatePath("/geo");
  });
}

const updateQuestionSchema = z.object({
  id: z.string().min(1),
  targetPageUrl: z.string().trim().max(500).optional().nullable(),
  priority: z.coerce.number().int().min(1).max(5).optional()
});

/** 질문 메타 수정 — 대응 페이지 URL·우선순위(질문 텍스트는 승인 무결성 때문에 불변). */
export async function updateGeoQuestion(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = updateQuestionSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const existing = await db.geoQuestion.findUnique({ where: { id: p.data.id } });
    if (!existing) throw new Error("NOT_FOUND");
    await assertClient(user, existing.clientId);

    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.geoQuestion.update({
        where: { id: p.data.id },
        data: {
          ...(p.data.targetPageUrl !== undefined ? { targetPageUrl: p.data.targetPageUrl || null } : {}),
          ...(p.data.priority !== undefined ? { priority: p.data.priority } : {})
        }
      });
      await recordAudit(tx, {
        actorId: user.id,
        action: "geo.question.update",
        targetType: "GeoQuestion",
        targetId: p.data.id,
        afterState: { targetPageUrl: p.data.targetPageUrl ?? undefined, priority: p.data.priority },
        ...meta
      });
    });
    revalidatePath("/geo");
  });
}

/** GEO 자동 관측 즉시 실행 — 승인/모니터링 질문을 설정된 엔진들에 자동으로 물어 기록. */
export async function runGeoWatchNow(input: unknown): Promise<ActionResult<{ asked: number; appeared: number; cited: number; failed: number; engines: string[] }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ clientId: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await assertClient(user, p.data.clientId);

    const r = await runGeoWatch(p.data.clientId);
    const meta = await requestMeta();
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "geo.watch.run",
        targetType: "GeoQuestion",
        targetId: p.data.clientId,
        afterState: { asked: r.asked, appeared: r.appeared, cited: r.cited, failed: r.failed, engines: r.engines },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
    revalidatePath("/geo");
    return { asked: r.asked, appeared: r.appeared, cited: r.cited, failed: r.failed, engines: r.engines };
  });
}

<<<<<<< HEAD
/** 질문 1건 → 답변 페이지(FAQ+Schema) 초안 자동 생성 → 콘텐츠 파이프라인(검수·승인·게시)으로. */
export async function generateAnswerPage(input: unknown): Promise<ActionResult<{ planId: string; high: number; medium: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ questionId: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const question = await db.geoQuestion.findUnique({ where: { id: p.data.questionId }, select: { clientId: true, answerPlanId: true, status: true } });
    if (!question) throw new Error("NOT_FOUND");
    if (question.answerPlanId) throw new Error("ALREADY_GENERATED");
    if (question.status !== "APPROVED" && question.status !== "MONITORING") throw new Error("ILLEGAL_TRANSITION");
    await assertClient(user, question.clientId);

    const r = await createAnswerPagePlan(p.data.questionId);
    const meta = await requestMeta();
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: "geo.answerPage.generate",
        targetType: "GeoQuestion",
        targetId: p.data.questionId,
        afterState: { planId: r.planId, high: r.high, medium: r.medium },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
    revalidatePath("/geo");
    revalidatePath(`/clients/${question.clientId}`);
    return r;
  });
}

=======
>>>>>>> origin/erp-v1
const recordSchema = z.object({
  questionId: z.string().min(1),
  engine: z.string().min(1),
  checkedOn: z.coerce.date(),
  appeared: z.boolean(),
  cited: z.boolean().default(false),
  competitorsMentioned: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  snippet: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
  evidenceUrl: z.string().trim().max(500).optional().nullable().transform((v) => v || null),
  memo: z.string().trim().max(1000).optional().nullable().transform((v) => v || null)
});

/** 답변 관측 기록 — (질문×엔진×일자) upsert. 같은 날 재실행 시 덮어씀. */
export async function recordGeoAnswer(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = recordSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    if (!isGeoEngine(d.engine)) throw new Error("VALIDATION");

    const question = await db.geoQuestion.findUnique({ where: { id: d.questionId } });
    if (!question) throw new Error("NOT_FOUND");
    await assertClient(user, question.clientId);

    // 날짜는 일 단위로 정규화(Unique [questionId, engine, checkedOn])
    const day = new Date(Date.UTC(d.checkedOn.getFullYear(), d.checkedOn.getMonth(), d.checkedOn.getDate()));

    const meta = await requestMeta();
    const saved = await db.$transaction(async (tx) => {
      const rec = await tx.geoAnswerRecord.upsert({
        where: {
          questionId_engine_checkedOn: { questionId: d.questionId, engine: d.engine, checkedOn: day }
        },
        create: {
          questionId: d.questionId,
          engine: d.engine,
          checkedOn: day,
          appeared: d.appeared,
          cited: d.cited,
          competitorsMentioned: d.competitorsMentioned,
          snippet: d.snippet,
          evidenceUrl: d.evidenceUrl,
          memo: d.memo,
          createdById: user.id
        },
        update: {
          appeared: d.appeared,
          cited: d.cited,
          competitorsMentioned: d.competitorsMentioned,
          snippet: d.snippet,
          evidenceUrl: d.evidenceUrl,
          memo: d.memo
        }
      });
      // 첫 기록이 생기면 질문을 모니터링 상태로
      if (question.status === "APPROVED") {
        await tx.geoQuestion.update({ where: { id: question.id }, data: { status: "MONITORING" } });
      }
      await recordAudit(tx, {
        actorId: user.id,
        action: "geo.answer.record",
        targetType: "GeoAnswerRecord",
        targetId: rec.id,
        afterState: { engine: d.engine, appeared: d.appeared, cited: d.cited },
        ...meta
      });
      return rec;
    });

    revalidatePath("/geo");
    return { id: saved.id };
  });
}