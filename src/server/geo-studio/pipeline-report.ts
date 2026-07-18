// GEO Studio · 통합 파이프라인 리포트 — PipelineResult → 고객 전달용 마크다운.
// M1~M5 전 단계를 한 문서로 묶는다(개별 M5 리포트는 report.ts renderReport).
import type { PipelineResult } from "./pipeline";

function comma(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 전체 파이프라인 결과 → 경영진/고객용 마크다운 진단 리포트. */
export function renderPipelineReport(r: PipelineResult): string {
  const { input, scanDate, stages, currentState, goal } = r;
  const m5 = stages.m5 as {
    task_count: number;
    period: string;
    expected_citation_boost_pp: number;
    estimated_roi_pct: number;
    estimated_revenue: number;
    channel_mix: { recommended_mix: Array<Record<string, unknown>>; total_expected_citation_boost: number } | null;
  };

  const lines: string[] = [
    `# GEO 진단·실행 리포트 — ${input.brand}`,
    "",
    `- 대상 카테고리: ${input.category}`,
    `- 진단 키워드: ${input.keywords.join(", ")}`,
    input.competitors && input.competitors.length ? `- 경쟁사: ${input.competitors.join(", ")}` : "",
    `- 진단일: ${scanDate}`,
    "",
    "> AI 검색 최적화(GEO) 5단계 파이프라인(스캔→CEP→콘텐츠→여정→캠페인) 자동 진단 결과입니다.",
    "",
    "## 종합 요약",
    "",
    "| 지표 | 값 | 단계 |",
    "|---|---|---|",
    `| AI 인용율 | ${stages.m1.citationRate}% | M1 스캔 |`,
    `| CEP 커버리지 | ${stages.m2.cepCoverage}% (${stages.m2.coveredCeps}/${stages.m2.totalCeps}) | M2 발굴 |`,
    `| 콘텐츠 GEO 점수 | ${stages.m3.geoScore} (${stages.m3.passed ? "게이트 통과" : "보완 필요"}) | M3 콘텐츠 |`,
    `| Topical Authority | ${stages.m4.taScore} · ${stages.m4.taGrade}등급 | M4 여정 |`,
    `| 예상 ROI | ${m5.estimated_roi_pct}% | M5 캠페인 |`,
    "",
    "## M1 · AI 인용 스캔",
    `4대 AI(ChatGPT·Gemini·Claude·Perplexity)에 총 ${stages.m1.totalQueries}개 질의 → 종합 인용율 **${stages.m1.citationRate}%**.`,
    "",
    "| 키워드 | 인용율 |",
    "|---|---|",
    ...Object.entries(stages.m1.byKeyword).map(([kw, pct]) => `| ${kw} | ${pct}% |`),
    "",
    "## M2 · CEP(진입점) 발굴",
    `발굴 CEP ${stages.m2.totalCeps}개 중 자사 커버 ${stages.m2.coveredCeps}개(커버리지 **${stages.m2.cepCoverage}%**), 화이트스페이스 ${stages.m2.whitespaceCount}개.`,
    stages.m2.topCep ? `- 최우선 CEP: **${stages.m2.topCep}**` : "",
    "",
    "## M3 · 콘텐츠 GEO 게이트",
    `최우선 CEP('${stages.m2.topCep ?? "—"}') 대상 콘텐츠 브리프 GEO 점수: **${stages.m3.geoScore}점** — ${stages.m3.passed ? "70점 이상, 발행 가치 확보" : "70점 미만, 보완 후 발행 권장"}.`,
    "",
    `- BLUF ${stages.m3.blufScore} · FAQ ${stages.m3.faqScore} · E-E-A-T ${stages.m3.eeatScore} · 인용성 ${stages.m3.citationScore}`,
    "",
    "## M4 · 고객 여정 · Topical Authority",
    `여정 노드 ${stages.m4.totalNodes}개, 브랜드 언급율 ${stages.m4.brandMentionRate}%, 콘텐츠 갭 ${stages.m4.gapCount}건. Topical Authority **${stages.m4.taScore}점(${stages.m4.taGrade}등급)**.`,
    "",
    "## M5 · 실행 캠페인 계획",
    `목표: AI 인용율 ${goal.targetValue}% · 예산 ${comma(goal.budget)}원 · 기간 ${m5.period}`,
    "",
    `- 실행 태스크: **${m5.task_count}건**`,
    `- 예상 인용율 상승: **+${m5.expected_citation_boost_pp}%p**`,
    `- 예상 ROI: **${m5.estimated_roi_pct}%** · 예상 기여 매출: **${comma(m5.estimated_revenue)}원**`,
    ""
  ];

  const mix = m5.channel_mix;
  if (mix) {
    lines.push("### 채널 믹스", "", "| 채널 | 예산% | 콘텐츠 | 예상 인용 상승 | 콘텐츠 유형 |", "|---|---|---|---|---|");
    for (const a of mix.recommended_mix) {
      const types = (a.content_types as string[]).join(", ");
      lines.push(`| ${a.channel} | ${a.budget_pct}% | ${a.content_count}건 | +${a.expected_citation_boost}%p | ${types} |`);
    }
    lines.push("", `**총 예상 인용 상승: +${mix.total_expected_citation_boost}%p**`);
  }

  if (stages.m3.briefMd) {
    lines.push("", "---", "", "## 부록 · 최우선 CEP 콘텐츠 브리프 (M3 산출물)", "", stages.m3.briefMd);
  }

  lines.push("", "---", `_현재 목(mock) 파이프라인 기반 결정적 산출물. 라이브 4-AI 연동 시 실측 데이터로 대체됩니다._`);

  return lines.join("\n");
}
