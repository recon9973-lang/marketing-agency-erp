"use server";

// 원고 스튜디오 — 거래처별 집필 프로젝트(프롬프트) CRUD. 실제 콘텐츠 생성은 GEO(콘텐츠 생성)에서 진행.
import { z } from "zod";

import { db } from "@/server/db";
import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { getDefaultOrgId } from "@/server/org";
import { generateMarketingContent, type AiContentKind } from "@/server/ai/claude";
import { checkMedicalLaw, type ComplianceResult } from "@/server/compliance/medical-law";

async function ensureTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "ManuscriptProject" ("id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "name" TEXT NOT NULL, "prompt" TEXT NOT NULL DEFAULT '', "notes" TEXT, "orgId" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ManuscriptProject_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ManuscriptProject_clientId_idx" ON "ManuscriptProject" ("clientId")`);
  } catch (e) {
    console.warn("[manuscript] 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

async function ensureDraftTable(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "ManuscriptDraft" ("id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "title" TEXT NOT NULL DEFAULT '', "kind" TEXT NOT NULL DEFAULT 'BLOG', "body" TEXT NOT NULL DEFAULT '', "source" TEXT NOT NULL DEFAULT 'manual', "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ManuscriptDraft_pkey" PRIMARY KEY ("id"))`
    );
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ManuscriptDraft_projectId_idx" ON "ManuscriptDraft" ("projectId")`);
  } catch (e) {
    console.warn("[manuscript] 초안 테이블 보장 실패(무시):", String(e).slice(0, 140));
  }
}

const DRAFT_KINDS = ["BLOG", "CARD_NEWS", "SNS", "AD_COPY"] as const;

export async function createManuscriptProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ clientId: z.string().min(1), name: z.string().min(1), prompt: z.string().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureTable();
    const orgId = await getDefaultOrgId().catch(() => null);
    const row = await db.manuscriptProject.create({
      data: { clientId: p.data.clientId, name: p.data.name.trim(), prompt: p.data.prompt ?? "", orgId: orgId ?? undefined, createdById: user.id }
    });
    return { id: row.id };
  });
}

export async function updateManuscriptProject(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1), name: z.string().optional(), prompt: z.string().optional() }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.manuscriptProject.update({
      where: { id: p.data.id },
      data: {
        ...(p.data.name !== undefined ? { name: p.data.name.trim() } : {}),
        ...(p.data.prompt !== undefined ? { prompt: p.data.prompt } : {})
      }
    });
  });
}

export async function deleteManuscriptProject(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.manuscriptProject.delete({ where: { id: p.data.id } });
  });
}

// ── 원고 초안(자체 제작) ─────────────────────────────────────

/** 초안 저장(신규/수정) — 직접 작성한 원고를 프로젝트에 보관. */
export async function saveManuscriptDraft(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z
      .object({
        id: z.string().optional().nullable(),
        projectId: z.string().min(1),
        title: z.string().max(200).optional(),
        kind: z.enum(DRAFT_KINDS).optional(),
        body: z.string().max(20000).optional(),
        source: z.enum(["manual", "ai"]).optional()
      })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureDraftTable();
    const d = p.data;
    if (d.id) {
      await db.manuscriptDraft.update({
        where: { id: d.id },
        data: {
          ...(d.title !== undefined ? { title: d.title.trim() } : {}),
          ...(d.kind !== undefined ? { kind: d.kind } : {}),
          ...(d.body !== undefined ? { body: d.body } : {})
        }
      });
      return { id: d.id };
    }
    const row = await db.manuscriptDraft.create({
      data: {
        projectId: d.projectId,
        title: (d.title ?? "").trim(),
        kind: d.kind ?? "BLOG",
        body: d.body ?? "",
        source: d.source ?? "manual",
        createdById: user.id
      }
    });
    return { id: row.id };
  });
}

/** AI 자체 제작 — 프로젝트 프롬프트를 브리프로 실제 원고를 생성해 초안으로 저장. */
export async function generateManuscriptDraft(
  input: unknown
): Promise<ActionResult<{ id: string; body: string; compliance: ComplianceResult | null }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z
      .object({
        projectId: z.string().min(1),
        topic: z.string().trim().min(1).max(500),
        kind: z.enum(DRAFT_KINDS),
        medicalCheck: z.boolean().optional()
      })
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await ensureDraftTable();
    const d = p.data;

    // 프로젝트 프롬프트(집필 방향) + 거래처 업종을 컨텍스트로.
    const project = await db.manuscriptProject.findUnique({
      where: { id: d.projectId },
      select: { prompt: true, clientId: true }
    });
    const client = project?.clientId
      ? await db.client.findUnique({
          where: { id: project.clientId },
          select: { name: true, industryCategory: { select: { name: true, parent: { select: { name: true } } } }, industryCustom: true }
        })
      : null;
    const clientName = client?.name ?? null;
    const industry = client?.industryCategory?.name ?? client?.industryCategory?.parent?.name ?? client?.industryCustom ?? null;

    // 키 없으면 여기서 AI_NOT_CONFIGURED throw.
    const body = await generateMarketingContent({
      kind: d.kind as AiContentKind,
      topic: d.topic,
      keywords: null,
      tone: project?.prompt || null,
      clientName,
      industry
    });

    const row = await db.manuscriptDraft.create({
      data: { projectId: d.projectId, title: d.topic.slice(0, 100), kind: d.kind, body, source: "ai", createdById: user.id }
    });
    const compliance = d.medicalCheck ? checkMedicalLaw(body) : null;
    return { id: row.id, body, compliance };
  });
}

export async function deleteManuscriptDraft(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    await db.manuscriptDraft.delete({ where: { id: p.data.id } });
  });
}
