import { HospitalProfile, Stage } from "./types";

// 부록 A 여정 단계 판별 기준 + §9.3 규칙 오버라이드
const SIGNALS: Record<Stage, string[]> = {
  exploration: [
    "원인", "증상", "초기", "이유", "란", "이란", "자가진단", "자가 진단", "수명", "통증",
    "뜻", "무엇", "언제", "왜", "기간", "과정", "종류란", "정의", "나이", "연령",
  ],
  comparison: [
    "vs", "차이", "후기", "부작용", "장단점", "장점", "단점", "종류", "가격대", "비교",
    "가격", "비용", "얼마", "브랜드", "재료", "국산", "수입", "추천",
  ],
  decision: [
    "예약", "위치", "잘하는곳", "잘하는 곳", "잘하는", "야간진료", "야간 진료", "주말진료",
    "주말 진료", "어디", "근처", "역", "병원", "치과", "의원", "클리닉", "피부과", "성형외과",
    "상담", "당일", "이벤트",
  ],
  retention: [
    "후 ", "시술후", "시술 후", "수술후", "수술 후", "관리", "주의사항", "주의 사항",
    "재검진", "유지기간", "유지 기간", "회복", "붓기", "음식", "음주", "흡연", "세척",
    "정기검진", "정기 검진", "사후",
  ],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function classifyStage(
  keyword: string,
  profile: HospitalProfile,
  mainKeyword?: string
): { stage: Stage; confidence: number } {
  const k = norm(keyword);
  const kNoSpace = k.replace(/\s+/g, "");

  // §9.3 규칙 오버라이드 1: 병원명/지역명 + 예약·위치·가격 → decision
  const brandHit = profile.name && kNoSpace.includes(profile.name.replace(/\s+/g, "").toLowerCase());
  const regionHit =
    (profile.regionSigungu && k.includes(profile.regionSigungu.toLowerCase())) ||
    (profile.regionDong && k.includes(profile.regionDong.toLowerCase()));
  if (brandHit) return { stage: "decision", confidence: 0.98 };

  // §9.3 규칙 오버라이드 2: "~후|관리|주의사항" → retention 우선
  if (/(후\s|후$|관리|주의사항|재검진|회복)/.test(k)) {
    return { stage: "retention", confidence: 0.9 };
  }

  // 시그널 매칭 전, 메인 키워드·자기 지역·병원명은 제거 —
  // 모든 하위 키워드에 공통으로 들어가므로 신호가 되지 못하는데,
  // "피부과" 같은 단어가 결정 시그널로 잡혀 전부 결정으로 쏠리는 문제 방지
  const stripTokens = [mainKeyword, profile.regionSigungu, profile.regionDong, profile.name]
    .filter((t): t is string => !!t)
    .map((t) => t.toLowerCase().replace(/\s+/g, ""))
    .sort((a, b) => b.length - a.length);
  let sigNoSpace = kNoSpace;
  let sig = k;
  for (const t of stripTokens) {
    sigNoSpace = sigNoSpace.split(t).join("");
    sig = sig.split(t).join(" ");
  }

  // 시그널 점수 매칭
  const scores: Record<Stage, number> = { exploration: 0, comparison: 0, decision: 0, retention: 0 };
  (Object.keys(SIGNALS) as Stage[]).forEach((stage) => {
    for (const s0 of SIGNALS[stage]) {
      const s = s0.toLowerCase();
      if (s.includes(" ") ? sig.includes(s) : sigNoSpace.includes(s.replace(/\s+/g, ""))) {
        scores[stage] += s.length >= 2 ? 2 : 1;
      }
    }
  });
  if (regionHit) scores.decision += 1;

  const entries = (Object.entries(scores) as [Stage, number][]).sort((a, b) => b[1] - a[1]);
  const [best, second] = entries;
  if (best[1] === 0) return { stage: "exploration", confidence: 0.4 }; // 기본값: 탐색
  const confidence = Math.min(0.95, 0.5 + (best[1] - second[1]) * 0.15);
  return { stage: best[0], confidence };
}

export function isBrandKeyword(keyword: string, profile: HospitalProfile): boolean {
  if (!profile.name) return false;
  return keyword.replace(/\s+/g, "").toLowerCase().includes(profile.name.replace(/\s+/g, "").toLowerCase());
}
