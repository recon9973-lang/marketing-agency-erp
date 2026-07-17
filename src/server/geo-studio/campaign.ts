// GEO Studio · M5 — 캠페인 오케스트레이션 (원본 campaign.py 이식).
// 목표·현재상태·업종·예산 → 태스크 분해 + 채널 믹스 + ROI + 요약.
import { isoAddDays, todayIso } from "./py-compat";
import { DEFAULT_SETTINGS, type Settings } from "./config";
import { decomposeGoal } from "./decompose";
import { recommendMix } from "./mix";
import { calculateRoi } from "./roi";
import { channelMixToRow, type Campaign, type CurrentState, type GeoGoal } from "./models";

export type BuildCampaignOptions = {
  team?: string[];
  channels?: string[];
  priorityCepCount?: number;
  startDate?: string;
  settings?: Settings;
};

/** 캠페인 종합 구성. */
export function buildCampaign(
  name: string,
  goal: GeoGoal,
  current: CurrentState,
  industry: string,
  opts: BuildCampaignOptions = {}
): Campaign {
  const settings = opts.settings ?? DEFAULT_SETTINGS;
  const start = opts.startDate ?? todayIso();
  const end = isoAddDays(start, goal.deadlineDays);
  const tasks = decomposeGoal(goal, current, opts.team, start, settings);
  const mix = recommendMix(industry, goal.budget, opts.priorityCepCount ?? 5, opts.channels);
  return { name, goal, startDate: start, endDate: end, status: "planning", tasks, channelMix: mix };
}

/** 캠페인 요약 지표(대시보드/리포트용) — 원본 campaign_summary. */
export function campaignSummary(campaign: Campaign, _current?: CurrentState, settings: Settings = DEFAULT_SETTINGS): Record<string, unknown> {
  const goal = campaign.goal;
  const boost = campaign.channelMix ? campaign.channelMix.totalExpectedCitationBoost : 0.0;

  const roi = calculateRoi(
    {
      citationRateIncreasePp: boost,
      investment: goal.budget || 1,
      months: Math.max(1, Math.floor(goal.deadlineDays / 30))
    },
    settings.roi
  );

  const statusCounts: Record<string, number> = {};
  for (const t of campaign.tasks) statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;

  return {
    campaign: campaign.name,
    period: `${campaign.startDate} ~ ${campaign.endDate}`,
    goal: { type: goal.goalType, target: goal.targetValue, deadline_days: goal.deadlineDays },
    task_count: campaign.tasks.length,
    task_status: statusCounts,
    expected_citation_boost_pp: boost,
    estimated_roi_pct: roi.roiPct,
    estimated_revenue: roi.revenue,
    channel_mix: campaign.channelMix ? channelMixToRow(campaign.channelMix) : null
  };
}
