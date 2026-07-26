// F-902 QPC (Question Psychology Classifier) — 질문 심리 분류 (v2.1 §1.3)
// 여정 4단계와 직교하는 심리 축: 질문자가 "무엇이 걸려서" 질문했는가

import { JNode } from "./types";

export type PsychCode = "ANX" | "CST" | "VRF" | "CMP" | "URG" | "SLF";

export const PSYCH_META: Record<
  PsychCode,
  { label: string; color: string; desc: string; direction: string }
> = {
  ANX: {
    label: "불안·공포",
    color: "#dc2626",
    desc: "부작용·실패·통증을 걱정",
    direction: "안전성 근거·의료진 경력·치료 과정을 투명하게 공개하는 콘텐츠",
  },
  CST: {
    label: "비용 부담",
    color: "#d97706",
    desc: "가격·과잉진료를 의심",
    direction: "비용 구성·기준을 설명 (할인 소구는 의료법 금지)",
  },
  VRF: {
    label: "검증·불신",
    color: "#7c3aed",
    desc: "후기 진위·광고 여부를 의심",
    direction: "제3자 근거·데이터 기반, 심의 준수 후기",
  },
  CMP: {
    label: "선택 갈등",
    color: "#2563eb",
    desc: "대안 비교로 결정을 못 함",
    direction: "비교표·케이스별 권장 기준 제시",
  },
  URG: {
    label: "시급성",
    color: "#db2777",
    desc: "당장 해결이 필요",
    direction: "야간·당일 진료 안내, 플레이스 최적화",
  },
  SLF: {
    label: "자가판단",
    color: "#16a34a",
    desc: "병원에 가야 할지 스스로 판단 중",
    direction: "자가 체크리스트 + 내원 기준 제시",
  },
};

export const PSYCH_CODES: PsychCode[] = ["ANX", "CST", "VRF", "CMP", "URG", "SLF"];

const SIGNALS: Record<PsychCode, string[]> = {
  ANX: [
    "무서", "무섭", "겁나", "겁이", "아픈가", "아프", "아파", "통증", "부작용", "잘못되",
    "큰일", "위험", "걱정", "후유증", "괜찮나", "괜찮은가", "괜찮을까", "탈나", "망하", "실패",
    "욱신", "시큰", "저리", "붓", "염증", "덧나",
  ],
  CST: [
    "바가지", "적정가", "얼마", "가격", "비용", "견적", "비싸", "저렴", "보험", "급여",
    "실비", "돈이", "가성비", "할부", "부담",
  ],
  VRF: [
    "실제로", "광고 말고", "광고말고", "진짜", "내돈내산", "믿어도", "사실인가", "과장",
    "찌라시", "협찬", "거르", "믿을만", "믿을 만", "구라",
  ],
  CMP: [
    "vs", "어떤게", "어떤 게", "나은지", "나을까", "고민", "차이", "비교", "뭐가",
    "어디가 나", "선택", "추천해", "골라", "어느", "중에",
  ],
  URG: ["당장", "응급", "오늘", "지금", "주말", "야간", "빨리", "급해", "급합", "바로", "일요일", "공휴일"],
  SLF: [
    "정상인가", "정상일까", "병원 가야", "병원가야", "가봐야", "저절로", "자가", "방치",
    "그냥 둬도", "그냥두면", "심한가", "심각한가", "낫나요", "나을까요", "자연치유",
  ],
};

export interface PsychResult {
  primary: PsychCode | null;
  scores: Partial<Record<PsychCode, number>>;
}

export function classifyPsych(text: string): PsychResult {
  const t = text.toLowerCase();
  const tNoSpace = t.replace(/\s+/g, "");
  const scores: Partial<Record<PsychCode, number>> = {};
  for (const code of PSYCH_CODES) {
    let s = 0;
    for (const sig of SIGNALS[code]) {
      if (sig.includes(" ") ? t.includes(sig) : tNoSpace.includes(sig.replace(/\s+/g, ""))) s += 1;
    }
    if (s > 0) scores[code] = s;
  }
  const sorted = (Object.entries(scores) as [PsychCode, number][]).sort((a, b) => b[1] - a[1]);
  return { primary: sorted[0]?.[0] ?? null, scores };
}

export interface PsychProfile {
  total: number; // 분석한 질문 수
  classified: number; // 심리가 잡힌 질문 수
  distribution: { code: PsychCode; count: number; ratio: number }[];
  topQuestions: Record<PsychCode, { keyword: string; sourceUrl?: string | null }[]>;
}

// 프로젝트의 지식iN 질문 노드들로 심리 프로필 산출 (기존 맵에도 즉시 적용 가능한 파생 계산)
export function buildPsychProfile(nodes: JNode[]): PsychProfile {
  const questions = nodes.filter((n) => n.kind === "keyword" && n.source === "naver_kin");
  const counts = {} as Record<PsychCode, number>;
  const topQuestions = {} as PsychProfile["topQuestions"];
  for (const c of PSYCH_CODES) {
    counts[c] = 0;
    topQuestions[c] = [];
  }
  let classified = 0;
  for (const q of questions) {
    const r = classifyPsych(q.keyword);
    if (!r.primary) continue;
    classified++;
    counts[r.primary]++;
    if (topQuestions[r.primary].length < 5) {
      topQuestions[r.primary].push({ keyword: q.keyword, sourceUrl: q.sourceUrl });
    }
  }
  const distribution = PSYCH_CODES.map((code) => ({
    code,
    count: counts[code],
    ratio: classified > 0 ? counts[code] / classified : 0,
  }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  return { total: questions.length, classified, distribution, topQuestions };
}
