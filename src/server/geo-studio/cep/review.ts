// GEO CEP · GPT 리뷰 합성 — 리스닝마인드 GPT 리뷰(종합분석/페르소나/자사언급) 재현.
// 현재는 CEP 데이터에서 결정적으로 합성하는 '목 GPT'(티어 🔵AI/근사). P2에서 4-AI 실호출로 교체.
// 순수 로직 → 테스트 가능.

export type ReviewCep = {
  cep_text: string;
  situation_tag?: string;
  emotion_tag?: string;
  time_tag?: string;
  place_tag?: string;
  companion_tag?: string;
  priority_score?: number;
  ai_mention_count?: number;
  is_whitespace?: boolean;
  keywords?: string[];
};

export type ReviewReport = {
  ceps: ReviewCep[];
  total_ceps: number;
  whitespace_count: number;
  candidate_count?: number;
  probe_count?: number;
  cep_share?: Record<string, number>;
};

export type Persona = { name: string; description: string; analysis: string; questions: string[] };

export type GptReview = {
  overview: { keywordAnalysis: string; serpAnalysis: string; cepAnalysis: string; strategy: string };
  personas: Persona[];
  brandMention: { coveredRate: number; whitespaceRate: number; note: string };
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

/** 상황 태그 → 페르소나 아키타입(설명 문구). */
function archetype(situation: string): { name: string; desc: string } {
  const map: Record<string, { name: string; desc: string }> = {
    힐링: { name: "휴식·재충전형", desc: "일상에서 벗어나 조용히 쉬고 재충전하려는 소비자" },
    가성비: { name: "합리적 소비형", desc: "가격 대비 만족을 꼼꼼히 따지는 실속형 소비자" },
    급긴: { name: "즉시 해결형", desc: "지금 당장 필요를 해결해야 하는 급한 상황의 소비자" },
    기념일: { name: "특별한 경험형", desc: "기념일·이벤트에 특별한 경험을 찾는 소비자" },
    트렌드: { name: "트렌드 민감형", desc: "SNS·최신 유행에 민감하게 반응하는 소비자" }
  };
  for (const key of Object.keys(map)) if (situation.includes(key)) return map[key];
  return { name: `${situation || "일반"}형`, desc: `'${situation || "일반"}' 맥락에서 정보를 탐색하는 소비자` };
}

/** cep_text → 질문 문장. */
function toQuestion(cepText: string): string {
  const t = cepText.replace(/\s+/g, " ").trim();
  return `${t} 중에서 어디가 가장 좋을까요?`;
}

export function buildGptReview(report: ReviewReport, brand: string, category: string): GptReview {
  const ceps = report.ceps ?? [];
  const covered = ceps.filter((c) => (c.ai_mention_count ?? 0) > 0).length;
  const coveredRate = pct(covered, ceps.length);
  const whitespaceRate = pct(report.whitespace_count, report.total_ceps || ceps.length);

  // 상황 태그 그룹 → 상위 3개 → 페르소나.
  const groups = new Map<string, ReviewCep[]>();
  for (const c of ceps) {
    const k = c.situation_tag || "일반";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(c);
  }
  const ranked = [...groups.entries()]
    .map(([tag, rows]) => ({ tag, rows, score: rows.reduce((s, r) => s + (r.priority_score ?? 0), 0) }))
    .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
    .slice(0, 3);

  const personas: Persona[] = ranked.map(({ tag, rows }, i) => {
    const a = archetype(tag);
    const top = [...rows].sort((x, y) => (y.priority_score ?? 0) - (x.priority_score ?? 0));
    const emotions = [...new Set(rows.map((r) => r.emotion_tag).filter(Boolean))].slice(0, 3).join("·");
    return {
      name: `페르소나 ${i + 1} · ${a.name}`,
      description: a.desc,
      analysis:
        `'${category}' 검색에서 '${tag}' 맥락으로 진입하는 그룹입니다(진입점 ${rows.length}개` +
        (emotions ? `, 감성: ${emotions}` : "") +
        `). 이들은 ${a.desc.replace(/소비자$/, "니즈")}를 가지고 있어, 해당 맥락을 정면으로 다루는 콘텐츠에 잘 반응합니다.`,
      questions: top.slice(0, 3).map((c) => toQuestion(c.cep_text))
    };
  });

  const topCeps = [...ceps].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0)).slice(0, 5);
  const overview = {
    keywordAnalysis:
      `'${category}' 관련 프로브 ${report.probe_count ?? "-"}건에서 후보 ${report.candidate_count ?? "-"}개를 추출해 ` +
      `${report.total_ceps || ceps.length}개 진입점(CEP)으로 정리했습니다. 상위 진입점은 ${topCeps
        .slice(0, 3)
        .map((c) => `'${c.cep_text}'`)
        .join(", ")} 입니다.`,
    serpAnalysis:
      `자사(${brand})가 언급되는 진입점은 ${covered}/${ceps.length}개(${coveredRate}%)이며, ` +
      `경쟁 없이 선점 가능한 화이트스페이스가 ${report.whitespace_count}개(${whitespaceRate}%) 확인됩니다.`,
    cepAnalysis:
      `가장 강한 진입점은 '${topCeps[0]?.cep_text ?? "-"}'(우선순위 ${topCeps[0]?.priority_score ?? 0})입니다. ` +
      `상황·감성·시간·장소·동반의 5차원 맥락이 결합된 지점일수록 콘텐츠 전환 여지가 큽니다.`,
    strategy:
      `① 자사 미언급 상위 진입점부터 콘텐츠로 선점 → ② 페르소나별 질문을 FAQ·비교표로 통합 → ` +
      `③ '${category}' 파일럿 콘텐츠의 GEO 점수를 게이트(70점)로 관리해 발행.`
  };

  return {
    overview,
    personas,
    brandMention: {
      coveredRate,
      whitespaceRate,
      note: `자사 언급 진입점 ${covered}개 · 화이트스페이스 ${report.whitespace_count}개(선점 기회)`
    }
  };
}
