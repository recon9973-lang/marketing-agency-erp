// GEO Studio · M5 채널 플래너 — 서버 액션. 계산 + (선택)저장.
// 이식된 순수 로직(src/server/geo-studio)을 화면에서 쓰도록 노출. 저장은 GeoCampaignPlan.
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser, runAction, type ActionResult } from "@/server/actions/_helpers";
import { getDefaultOrgId } from "@/server/org";
import { db } from "@/server/db";
import { buildCampaign, campaignSummary } from "@/server/geo-studio/campaign";
import { kpiProgressRows, kpiToRow } from "@/server/geo-studio/kpi";
import { calendarView, upcomingDeadlines } from "@/server/geo-studio/calendar";
import { renderReport } from "@/server/geo-studio/report";
import { taskToRow, GOAL_TYPES, type CurrentState, type GeoGoal } from "@/server/geo-studio/models";

const planSchema = z.object({
  name: z.string().min(1).max(80),
  industry: z.string().min(1).max(40),
  goalType: z.enum(GOAL_TYPES),
  targetValue: z.number().min(0).max(1_000_000),
  deadlineDays: z.number().int().min(1).max(3650),
  budget: z.number().int().min(0).max(100_000_000_000),
  teamSize: z.number().int().min(1).max(50),
  priorityCepCount: z.number().int().min(1).max(100).default(5),
  team: z.array(z.string().min(1).max(30)).max(50).optional(),
  citationRate: z.number().min(0).max(100).default(0),
  cepCoverage: z.number().min(0).max(100).default(0),
  taScore: z.number().min(0).max(100).default(0),
  totalCeps: z.number().int().min(0).max(100000).default(0),
  coveredCeps: z.number().int().min(0).max(100000).default(0)
});

export type GeoPlanResult = {
  campaign: { name: string; startDate: string; endDate: string; taskCount: number };
  summary: Record<string, unknown>;
  kpi: Array<Record<string, unknown>>;
  tasks: Array<Record<string, unknown>>;
  calendar: Record<string, Array<Record<string, unknown>>>;
  upcoming: Array<Record<string, unknown>>;
  report: string;
};

/** 검증된 입력 → GeoPlanResult 계산(순수, 재사용). */
function computePlan(d: z.infer<typeof planSchema>): GeoPlanResult {
  const goal: GeoGoal = {
    goalType: d.goalType,
    targetValue: d.targetValue,
    deadlineDays: d.deadlineDays,
    budget: d.budget,
    teamSize: d.teamSize
  };
  const current: CurrentState = {
    citationRate: d.citationRate,
    cepCoverage: d.cepCoverage,
    taScore: d.taScore,
    totalCeps: d.totalCeps,
    coveredCeps: d.coveredCeps
  };

  const team = d.team && d.team.length ? d.team : undefined;
  const campaign = buildCampaign(d.name, goal, current, d.industry, { team, priorityCepCount: d.priorityCepCount });
  const summary = campaignSummary(campaign, current);

  return {
    campaign: {
      name: campaign.name,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      taskCount: campaign.tasks.length
    },
    summary: summary as Record<string, unknown>,
    kpi: kpiProgressRows(goal, current).map(kpiToRow),
    tasks: campaign.tasks.map(taskToRow),
    calendar: calendarView(campaign.tasks),
    upcoming: upcomingDeadlines(campaign.tasks, 7, campaign.startDate).map(taskToRow),
    report: renderReport(summary as never, current)
  };
}

/** 입력(목표·현재상태·업종·예산) → GEO 캠페인 계획을 계산해 반환. DB 저장 없음. */
export async function planGeoCampaign(input: unknown): Promise<ActionResult<GeoPlanResult>> {
  return runAction(async () => {
    await requireUser();
    const p = planSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    return computePlan(p.data);
  });
}

/** 계획을 계산 후 GeoCampaignPlan으로 저장. 목록 재열람용. */
export async function saveGeoCampaignPlan(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireUser();
    const p = planSchema.safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const d = p.data;
    const result = computePlan(d);
    const orgId = await getDefaultOrgId();

    const saved = await db.geoCampaignPlan.create({
      data: {
        orgId,
        name: d.name,
        industry: d.industry,
        goalType: d.goalType,
        budget: d.budget,
        result: result as unknown as object,
        report: result.report,
        createdById: user.id
      }
    });
    revalidatePath("/geo-planner");
    return { id: saved.id };
  });
}

/** 저장된 계획 삭제(작성자 본인만). */
export async function deleteGeoCampaignPlan(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const p = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!p.success) throw new Error("VALIDATION");
    const plan = await db.geoCampaignPlan.findUnique({ where: { id: p.data.id }, select: { createdById: true } });
    if (!plan) throw new Error("NOT_FOUND");
    if (plan.createdById !== user.id) throw new Error("FORBIDDEN");
    await db.geoCampaignPlan.delete({ where: { id: p.data.id } });
    revalidatePath("/geo-planner");
  });
}
