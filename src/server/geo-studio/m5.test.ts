// GEO Studio · M5 채널 플래너 — 종합 골든 테스트.
// 픽스처(__fixtures__/m5.golden.json)는 원본 파이썬 geo_channel_planner를 고정 입력으로 실행해 생성.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { listChannels } from "./channels";
import { recommendMix } from "./mix";
import { analyzeGap, decomposeGoal } from "./decompose";
import { kpiProgressRows, kpiToRow, makeSnapshot, snapshotToRow } from "./kpi";
import { calendarView, suggestPublishTiming, upcomingDeadlines } from "./calendar";
import { buildCampaign, campaignSummary } from "./campaign";
import { renderReport } from "./report";
import { channelMixToRow, taskToRow, type CurrentState, type GeoGoal } from "./models";

const golden = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/m5.golden.json"), "utf8")
);

const GOAL: GeoGoal = { goalType: "citation_rate", targetValue: 25.0, deadlineDays: 90, budget: 5_000_000, teamSize: 3 };
const CUR: CurrentState = { citationRate: 18, cepCoverage: 55, taScore: 62, totalCeps: 20, coveredCeps: 11 };
const TEAM = ["김", "이", "박"];
const SD = "2026-07-20";

describe("M5 · 채널/카탈로그", () => {
  it("list_channels", () => expect(listChannels()).toEqual(golden.list_channels));
  it("mix — 카페", () => expect(channelMixToRow(recommendMix("카페", 5_000_000, 5))).toEqual(golden.mix_cafe));
  it("mix — 병원(권위채널)", () => expect(channelMixToRow(recommendMix("병원", 3_000_000, 8))).toEqual(golden.mix_hospital));
});

describe("M5 · 목표분해", () => {
  it("analyze_gap (4 goal types)", () => {
    for (const t of ["citation_rate", "cep_coverage", "ta_score", "roi"] as const) {
      const g: GeoGoal = { goalType: t, targetValue: 25.0, deadlineDays: 90, budget: 5_000_000, teamSize: 3 };
      const r = analyzeGap(g, CUR);
      expect({ gap: r.gap, content_needed: r.contentNeeded }).toEqual(golden.gap[t]);
    }
  });
  it("decompose_goal → 40 태스크(담당자 라운드로빈·마감 분배)", () => {
    const tasks = decomposeGoal(GOAL, CUR, TEAM, SD);
    expect(tasks.map(taskToRow)).toEqual(golden.decompose);
  });
});

describe("M5 · KPI", () => {
  it("kpi_progress", () => expect(kpiProgressRows(GOAL, CUR).map(kpiToRow)).toEqual(golden.kpi));
  it("make_snapshot", () => expect(snapshotToRow(makeSnapshot(CUR, 212.0, "2026-07-20"))).toEqual(golden.snapshot));
});

describe("M5 · 캘린더", () => {
  const tasks = decomposeGoal(GOAL, CUR, TEAM, SD);
  it("calendar_view", () => expect(calendarView(tasks)).toEqual(golden.calendar));
  it("suggest_publish_timing", () => expect(suggestPublishTiming("2026-07-20")).toEqual(golden.publish_timing));
  it("upcoming_deadlines", () => expect(upcomingDeadlines(tasks, 1, "2026-07-20").map(taskToRow)).toEqual(golden.upcoming));
});

describe("M5 · 캠페인 오케스트레이션", () => {
  const camp = buildCampaign("Q3 GEO", GOAL, CUR, "카페", { team: TEAM, priorityCepCount: 5, startDate: SD });
  it("build_campaign 메타", () => {
    expect({ name: camp.name, start: camp.startDate, end: camp.endDate, status: camp.status, task_count: camp.tasks.length }).toEqual(
      golden.campaign_meta
    );
  });
  it("campaign_summary (ROI·채널믹스 포함)", () => {
    expect(campaignSummary(camp, CUR)).toEqual(golden.summary);
  });
  it("render_report — 핵심 값 포함", () => {
    const md = renderReport(campaignSummary(camp, CUR) as never, CUR);
    expect(md).toContain("# GEO 캠페인 리포트 — Q3 GEO");
    expect(md).toContain("기간: 2026-07-20 ~ 2026-10-18");
    expect(md).toContain("예상 기여 매출: 15,930,000원");
    expect(md).toContain("총 40건");
    expect(md).toContain("| 채널 | 예산% | 콘텐츠 | 예상 인용 상승 | 콘텐츠 유형 |");
  });
});
