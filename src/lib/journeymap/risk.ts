import { RiskLevel, RiskReason } from "./types";

interface RiskRule {
  id: string;
  patterns: string[]; // 포함 매칭 (정규화 후)
  level: Exclude<RiskLevel, "none">;
  law: string;
  description: string;
  suggestion: string;
}

// §10 의료법 리스크 사전 (MVP 룰셋)
const RULES: RiskRule[] = [
  {
    id: "price-bait",
    patterns: ["최저가", "파격할인", "파격 할인", "이벤트가", "반값", "무료시술", "무료 시술", "비용면제", "비용 면제", "덤핑", "초특가", "할인이벤트", "할인 이벤트", "공짜"],
    level: "red",
    law: "의료법 제27조 제3항 · 제56조",
    description: "가격 유인·환자 알선 소지가 있는 표현입니다.",
    suggestion: "예: \"비용 구성 안내\", \"가격 결정 요인\" 등 정보성 표현으로 대체하세요.",
  },
  {
    id: "guarantee",
    patterns: ["100%", "완치", "부작용없음", "부작용 없음", "부작용없는", "흉터없이", "흉터 없이", "통증제로", "통증 제로", "무통증", "보장", "재발없음", "재발 없음", "영구적"],
    level: "red",
    law: "의료법 제56조 제2항 (치료효과 보장 금지)",
    description: "치료 효과를 보장하는 표현은 금지됩니다.",
    suggestion: "예: \"치료 과정 안내\", \"통증 관리 방법\" 등 과정 중심 표현으로 대체하세요.",
  },
  {
    id: "compare-slander",
    patterns: ["1등", "최고의", "제일잘하는", "제일 잘하는", "보다잘하는", "보다 잘하는", "국내유일", "국내 유일", "넘버원", "no.1", "no1", "최상급"],
    level: "red",
    law: "의료법 제56조 제2항 (비교·비방 광고 금지)",
    description: "다른 의료기관과의 비교·최상급 표현은 금지됩니다.",
    suggestion: "예: \"진료 철학\", \"의료진 소개\" 등 객관적 정보로 대체하세요.",
  },
  {
    id: "testimonial",
    patterns: ["후기", "경험담", "전후사진", "전후 사진", "비포애프터", "비포 애프터", "리얼후기", "리얼 후기", "실제후기", "실제 후기", "체험단"],
    level: "yellow",
    law: "의료법 제56조 (치료경험담 조건부 제한)",
    description: "치료 경험담·전후사진은 대가성/재공유 시 금지, 사전심의 대상일 수 있습니다.",
    suggestion: "자발적 후기라도 심의 기준을 확인하고, 대가 제공 여부를 명확히 하세요.",
  },
  {
    id: "media-cite",
    patterns: ["tv출연", "tv 출연", "방송에나온", "방송에 나온", "방송출연", "방송 출연", "뉴스에나온", "뉴스에 나온"],
    level: "yellow",
    law: "의료법 제56조 (신문·방송 인용 조건부)",
    description: "신문·방송 인용은 조건부 허용이며 심의 확인이 필요합니다.",
    suggestion: "출연 사실만 객관적으로 기재하고 과장 표현을 피하세요.",
  },
  {
    id: "ai-content",
    patterns: ["ai의사", "ai 의사", "가상의료진", "가상 의료진"],
    level: "yellow",
    law: "AI 생성물 표시 의무 안내",
    description: "AI 제작물은 AI 생성 사실을 명시해야 합니다.",
    suggestion: "AI 생성 콘텐츠임을 표기하세요.",
  },
  {
    id: "event",
    patterns: ["이벤트", "프로모션", "특가"],
    level: "yellow",
    law: "의료법 제27조·제56조 (유인 소지)",
    description: "이벤트·프로모션성 표현은 환자 유인으로 판단될 수 있습니다.",
    suggestion: "가격 정보는 비급여 고지 형태의 객관적 안내로 제공하세요.",
  },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export function scanRisk(keyword: string): { level: RiskLevel; reasons: RiskReason[] } {
  const norm = normalize(keyword);
  const reasons: RiskReason[] = [];
  let level: RiskLevel = "none";
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (norm.includes(normalize(p))) {
        reasons.push({
          ruleId: rule.id,
          matched: p,
          law: rule.law,
          description: rule.description,
          suggestion: rule.suggestion,
        });
        if (rule.level === "red") level = "red";
        else if (level !== "red") level = "yellow";
        break;
      }
    }
  }
  return { level, reasons };
}

export const RISK_DISCLAIMER = "본 안내는 참고용이며 법률 자문을 대체하지 않습니다.";
