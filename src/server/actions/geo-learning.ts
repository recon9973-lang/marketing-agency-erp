// GEO 학습 모듈 액션 — 제안(학습)·적용·다운그레이드(넘버/기간/부분). 관리자 전용.
// 원칙: 자동 적용 없음(사람 승인형). 모든 변경은 감사 로그 + 버전 넘버링으로 추적/롤백.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser, runAction, recordAudit, requestMeta, type ActionResult } from "@/server/actions/_helpers";
import { getDefaultOrgId } from "@/server/org";
import { db } from "@/server/db";
import { Role } from "@/domain/types";
import { getGlobalKindSummary } from "@/server/repositories/geo-intervention";
import { getActiveModelVersion, nextVersionNumber } from "@/server/repositories/geo-model";
import { learnWeights, diffWeights, shouldProposeVersion, type LearnedWeight } from "@/domain/geo/learning";

function assertAdmin(role: Role) {
  if (role !== Role.SUPER_ADMIN && role !== Role.ADMIN) throw new Error("FORBIDDEN");
}

async function notifyAdmins(actorId: string, orgId: string | null, version: number, summary: string) {
  const admins = await db.user.findMany({
    where: { role: { in: [Role.SUPER_ADMIN, Role.ADMIN] }, status: "ACTIVE" },
    select: { id: true }
  });
  if (admins.length === 0) return;
  await db.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      actorId,
      type: "GEO_UPGRADE",
      title: `GEO 학습 업그레이드 #${version} 제안`,
      body: summary,
      link: "/geo-learning",
      targetType: "GeoModelVersion",
      orgId
    }))
  });
}

/** 학습 실행 → 유의미하면 새 버전 제안(PROPOSED) + 관리자 공지. 이미 대기 제안이 있으면 그걸 반환. */
export async function proposeGeoModel(): Promise<ActionResult<{ proposed: boolean; version?: number; reason?: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertAdmin(user.role);
    const orgId = await getDefaultOrgId();

    // 이미 대기 중 제안이 있으면 중복 생성 금지.
    const pending = await db.geoModelVersion.findFirst({ where: { orgId, status: "PROPOSED" }, orderBy: { version: "desc" } });
    if (pending) return { proposed: true, version: pending.version, reason: "이미 대기 중인 제안이 있습니다." };

    const summaries = await getGlobalKindSummary(orgId);
    const model = learnWeights(summaries);
    const active = await getActiveModelVersion(orgId);
    const prevWeights = (active?.weights as unknown as LearnedWeight[]) ?? null;

    if (!shouldProposeVersion(prevWeights, model)) {
      return { proposed: false, reason: model.basisCount < 5 ? `학습 표본 부족(${model.basisCount}/5)` : "직전 대비 유의미한 변화 없음" };
    }

    const version = await nextVersionNumber(orgId);
    const diff = prevWeights ? diffWeights(prevWeights, model.weights) : model.weights.map((w) => ({ kind: w.kind, label: w.label, before: null, after: w.weight, delta: w.weight }));

    const created = await db.geoModelVersion.create({
      data: {
        version,
        orgId,
        status: "PROPOSED",
        summary: model.summary,
        weights: model.weights as unknown as object,
        diff: diff as unknown as object,
        basisCount: model.basisCount,
        proposedById: user.id
      }
    });
    await notifyAdmins(user.id, orgId, version, model.summary).catch(() => undefined);
    const meta = await requestMeta();
    await recordAudit(db, { actorId: user.id, action: "geo.model.propose", targetType: "GeoModelVersion", targetId: created.id, afterState: { version, summary: model.summary }, ...meta });

    revalidatePath("/geo-learning");
    return { proposed: true, version };
  });
}

/** 제안 버전을 적용(ACTIVE) — 기존 활성은 SUPERSEDED. */
export async function applyGeoModel(input: unknown): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertAdmin(user.role);
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const orgId = await getDefaultOrgId();

    const target = await db.geoModelVersion.findUnique({ where: { id: p.data.id } });
    if (!target || target.orgId !== orgId) throw new Error("NOT_FOUND");

    await db.$transaction([
      db.geoModelVersion.updateMany({ where: { orgId, status: "ACTIVE" }, data: { status: "SUPERSEDED" } }),
      db.geoModelVersion.update({ where: { id: target.id }, data: { status: "ACTIVE", appliedById: user.id, appliedAt: new Date() } })
    ]);
    const meta = await requestMeta();
    await recordAudit(db, { actorId: user.id, action: "geo.model.apply", targetType: "GeoModelVersion", targetId: target.id, afterState: { version: target.version }, ...meta });

    revalidatePath("/geo-learning");
    return { version: target.version };
  });
}

/**
 * 다운그레이드 — 넘버(toVersion) 또는 기간(afterDate) 기준.
 * - toVersion: 그 버전을 ACTIVE로, 더 높은 번호는 ROLLED_BACK.
 * - afterDate: 그 시각 이후 생성분을 ROLLED_BACK, 그 이전 최신을 ACTIVE.
 */
export async function rollbackGeoModel(input: unknown): Promise<ActionResult<{ activeVersion: number | null }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertAdmin(user.role);
    const p = z
      .object({ toVersion: z.number().int().positive().optional(), afterDate: z.string().optional() })
      .refine((d) => d.toVersion != null || d.afterDate, "toVersion 또는 afterDate 필요")
      .safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const orgId = await getDefaultOrgId();

    let targetVersion: number | null = null;
    if (p.data.toVersion != null) {
      targetVersion = p.data.toVersion;
    } else {
      const cutoff = new Date(p.data.afterDate as string);
      const latestBefore = await db.geoModelVersion.findFirst({
        where: { orgId, createdAt: { lte: cutoff } },
        orderBy: { version: "desc" },
        select: { version: true }
      });
      targetVersion = latestBefore?.version ?? null;
    }

    const target = targetVersion != null
      ? await db.geoModelVersion.findFirst({ where: { orgId, version: targetVersion } })
      : null;
    if (!target) throw new Error("NOT_FOUND");

    await db.$transaction([
      // 대상보다 높은 번호는 롤백 처리.
      db.geoModelVersion.updateMany({ where: { orgId, version: { gt: target.version } }, data: { status: "ROLLED_BACK" } }),
      db.geoModelVersion.updateMany({ where: { orgId, status: "ACTIVE" }, data: { status: "SUPERSEDED" } }),
      db.geoModelVersion.update({ where: { id: target.id }, data: { status: "ACTIVE", appliedById: user.id, appliedAt: new Date() } })
    ]);
    const meta = await requestMeta();
    await recordAudit(db, { actorId: user.id, action: "geo.model.rollback", targetType: "GeoModelVersion", targetId: target.id, afterState: { activeVersion: target.version, mode: p.data.toVersion != null ? "number" : "period" }, ...meta });

    revalidatePath("/geo-learning");
    return { activeVersion: target.version };
  });
}

/**
 * 부분 다운그레이드 — 활성 버전에서 특정 종류(kind)의 가중치만 직전 버전 값으로 되돌린
 * 새 버전을 만들어 적용. 부분 변경도 버전으로 추적(감사·재롤백 가능).
 */
export async function rollbackWeightKind(input: unknown): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const user = await requireUser();
    assertAdmin(user.role);
    const p = z.object({ kind: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const orgId = await getDefaultOrgId();

    const active = await getActiveModelVersion(orgId);
    if (!active) throw new Error("NOT_FOUND");
    const prev = await db.geoModelVersion.findFirst({
      where: { orgId, version: { lt: active.version } },
      orderBy: { version: "desc" }
    });
    const activeW = (active.weights as unknown as LearnedWeight[]) ?? [];
    const prevW = (prev?.weights as unknown as LearnedWeight[]) ?? [];
    const prevKind = prevW.find((w) => w.kind === p.data.kind);

    // 해당 kind만 이전 값으로 치환(없으면 0으로).
    const patched = activeW.map((w) => (w.kind === p.data.kind ? { ...w, weight: prevKind?.weight ?? 0 } : w));
    const version = await nextVersionNumber(orgId);
    const created = await db.geoModelVersion.create({
      data: {
        version,
        orgId,
        status: "ACTIVE",
        summary: `부분 롤백: ${p.data.kind} 가중치를 v${prev?.version ?? "0"} 값으로 되돌림`,
        weights: patched as unknown as object,
        diff: diffWeights(activeW, patched) as unknown as object,
        basisCount: active.basisCount,
        proposedById: user.id,
        appliedById: user.id,
        appliedAt: new Date()
      }
    });
    await db.geoModelVersion.updateMany({ where: { orgId, status: "ACTIVE", id: { not: created.id } }, data: { status: "SUPERSEDED" } });
    const meta = await requestMeta();
    await recordAudit(db, { actorId: user.id, action: "geo.model.partial_rollback", targetType: "GeoModelVersion", targetId: created.id, afterState: { version, kind: p.data.kind }, ...meta });

    revalidatePath("/geo-learning");
    return { version };
  });
}
