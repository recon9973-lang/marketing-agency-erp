import "server-only";
/**
 * 검색 여정·퍼널 — 수집한 키워드를 환자 검색 의도로 분류해 여정 단계 → 퍼널 → 채널·메시지·KPI로 매핑.
 * 제안 덱 "환자 검색 여정"(문제인식→정보탐색→비교→병원검토→예약) + "퍼널 전략"(인지·고려·전환)을
 * 결정형 규칙으로 자동 생성한다. 키워드 실측(검색량)을 그대로 근거로 쓴다(날조 없음).
 */
import type { KeywordScanRow } from "@/server/market/keyword-scan";

export type JourneyStage = "문제인식" | "정보탐색" | "비교" | "병원검토" | "예약";
export type FunnelStage = "인지" | "고려" | "전환";

export type JourneyKeyword = { keyword: string; total: number | null; stage: JourneyStage; funnel: FunnelStage };
export type FunnelPlan = {
  funnel: FunnelStage;
  goal: string;
  message: string;
  channels: string[];
  kpi: string;
  keywords: string[]; // 이 퍼널에 속한 대표 키워드
  searchVolume: number; // 합계 검색수
};
export type JourneyFunnel = { keywords: JourneyKeyword[]; funnel: FunnelPlan[] };

// 여정 → 퍼널 귀속.
const STAGE_TO_FUNNEL: Record<JourneyStage, FunnelStage> = {
  문제인식: "인지",
  정보탐색: "인지",
  비교: "고려",
  병원검토: "전환",
  예약: "전환"
};

// 퍼널 전략(덱 p5~6 규칙).
const FUNNEL_DEF: Record<FunnelStage, Omit<FunnelPlan, "keywords" | "searchVolume">> = {
  인지: {
    funnel: "인지",
    goal: "증상·질환 관심 포착",
    message: "증상·원인·치료법 정보 콘텐츠로 검색 노출",
    channels: ["네이버 블로그", "구글 SEO", "지식iN"],
    kpi: "노출·유입·신규 방문"
  },
  고려: {
    funnel: "고려",
    goal: "치료 대안·신뢰 형성",
    message: "치료법·비용·비교·후기 콘텐츠로 선택 지원",
    channels: ["블로그", "플레이스", "지식백과·위키"],
    kpi: "콘텐츠 참여·재방문"
  },
  전환: {
    funnel: "전환",
    goal: "병원 검토·예약 촉진",
    message: "의료진·시술 랜딩 + 상담 CTA, 플레이스 정보 완성",
    channels: ["네이버 플레이스", "검색광고(파워링크)", "홈페이지 랜딩"],
    kpi: "상담·예약·전환율"
  }
};

/** 키워드 의도 → 여정 단계(정규식 우선순위). */
export function classifyIntent(keyword: string): JourneyStage {
  const k = keyword.replace(/\s+/g, "");
  if (/예약|상담|문의|전화|접수/.test(k)) return "예약";
  if (/이유|원인|왜|증상|아픈|아파|통증(?!치료)/.test(k)) return "문제인식";
  if (/비교|차이|vs|추천|어디|잘하는|잘보는|후기|리뷰|순위|best|베스트/i.test(k)) return "비교";
  if (/치료|방법|효과|관리|수술|시술|한약|주사|검사|가격|비용|얼마/.test(k)) return "정보탐색";
  // 지역+진료과/병원 지역성 키워드 → 병원 검토(로컬 전환 의도)
  return "병원검토";
}

/** 키워드 실측 → 여정·퍼널 구조. */
export function buildJourneyFunnel(rows: KeywordScanRow[]): JourneyFunnel {
  const keywords: JourneyKeyword[] = rows.map((r) => {
    const stage = classifyIntent(r.keyword);
    return { keyword: r.keyword, total: r.total, stage, funnel: STAGE_TO_FUNNEL[stage] };
  });

  const funnel: FunnelPlan[] = (["인지", "고려", "전환"] as FunnelStage[]).map((f) => {
    const mine = keywords.filter((k) => k.funnel === f);
    return {
      ...FUNNEL_DEF[f],
      keywords: mine.map((k) => k.keyword).slice(0, 8),
      searchVolume: mine.reduce((s, k) => s + (k.total ?? 0), 0)
    };
  });

  return { keywords, funnel };
}

const STAGE_ORDER: JourneyStage[] = ["문제인식", "정보탐색", "비교", "병원검토", "예약"];

/** 여정·퍼널 마크다운(통합 브리프용). */
export function journeyFunnelMarkdown(jf: JourneyFunnel): string {
  const L: string[] = [];
  L.push(`## 5. 검색 여정·퍼널`);
  // 여정 단계별 키워드
  for (const stage of STAGE_ORDER) {
    const ks = jf.keywords.filter((k) => k.stage === stage);
    if (ks.length) L.push(`- **${stage}**: ${ks.map((k) => k.keyword).join(", ")}`);
  }
  L.push("");
  L.push(`| 퍼널 | 목표 | 권장 메시지 | 채널 | KPI | 검색수 |`);
  L.push(`|---|---|---|---|---|---:|`);
  for (const p of jf.funnel)
    L.push(`| ${p.funnel} | ${p.goal} | ${p.message} | ${p.channels.join("·")} | ${p.kpi} | ${p.searchVolume.toLocaleString("ko-KR")} |`);
  return L.join("\n");
}
