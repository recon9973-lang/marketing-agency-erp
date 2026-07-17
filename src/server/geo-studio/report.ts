// GEO Studio · M5 — 캠페인 종합 리포트 (원본 report.py 이식).
// campaign_summary 결과 → 경영진용 마크다운. (표시 계층: 정확한 수치는 데이터 함수에서 검증됨)
import type { CurrentState } from "./models";

/** 천단위 콤마(파이썬 `{:,.0f}`). */
function comma(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + s;
}

type Summary = {
  campaign: string;
  period: string;
  goal: { type: string; target: number; deadline_days: number };
  task_count: number;
  task_status: Record<string, number>;
  expected_citation_boost_pp: number;
  estimated_roi_pct: number;
  estimated_revenue: number;
  channel_mix: { recommended_mix: Array<Record<string, unknown>>; total_expected_citation_boost: number } | null;
};

/** 캠페인 요약 → 경영진 마크다운 리포트. */
export function renderReport(summary: Summary, current: CurrentState): string {
  const goal = summary.goal;
  const lines: string[] = [
    `# GEO 캠페인 리포트 — ${summary.campaign}`,
    "",
    `기간: ${summary.period}`,
    "",
    "## 목표",
    `- 유형: ${goal.type}`,
    `- 목표 수치: ${goal.target}`,
    `- 마감: D+${goal.deadline_days}`,
    "",
    "## 현재 지표 (M1~M4)",
    `- AI 인용율: ${current.citationRate}%`,
    `- CEP 커버리지: ${current.cepCoverage}%`,
    `- Topical Authority: ${current.taScore}`,
    "",
    "## 예상 성과",
    `- 인용율 상승 예상: +${summary.expected_citation_boost_pp}%p`,
    `- 예상 ROI: ${summary.estimated_roi_pct}%`,
    `- 예상 기여 매출: ${comma(summary.estimated_revenue)}원`,
    "",
    "## 실행 태스크",
    `- 총 ${summary.task_count}건 · 상태: ` +
      Object.entries(summary.task_status)
        .map(([k, v]) => `${k} ${v}`)
        .join(", "),
    "",
    "## 채널 믹스"
  ];
  const mix = summary.channel_mix;
  if (mix) {
    lines.push("");
    lines.push("| 채널 | 예산% | 콘텐츠 | 예상 인용 상승 | 콘텐츠 유형 |");
    lines.push("|---|---|---|---|---|");
    for (const a of mix.recommended_mix) {
      const types = (a.content_types as string[]).join(", ");
      lines.push(`| ${a.channel} | ${a.budget_pct}% | ${a.content_count}건 | +${a.expected_citation_boost}%p | ${types} |`);
    }
    lines.push("");
    lines.push(`**총 예상 인용 상승: +${mix.total_expected_citation_boost}%p**`);
  }
  return lines.join("\n");
}
