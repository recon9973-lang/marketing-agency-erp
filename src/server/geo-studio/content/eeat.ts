// GEO Studio · M3 콘텐츠 빌더 — E-E-A-T 진단 (원본 eeat.py 이식, 결정적 체크리스트).
import { pyRound } from "../py-compat";
import { normalize } from "./textutil";
import type { EeatReport } from "./models";

type Axis = "experience" | "expertise" | "authoritativeness" | "trustworthiness";

const SIGNALS: Record<Axis, [surfaces: string[], desc: string]> = {
  experience: [["직접", "경험", "사용해", "방문해", "후기", "실제로", "체험", "테스트", "써본"], "1인칭 경험·실사용 후기 (예: '직접 사용해 보니')"],
  expertise: [["전문", "자격", "면허", "박사", "연구", "논문", "데이터", "통계", "%", "수치"], "전문 자격·데이터·수치 근거"],
  authoritativeness: [["출처", "인용", "발표", "기관", "협회", "정부", "공식", "보고서", "저자"], "출처·권위 기관 인용·저자 정보"],
  trustworthiness: [["업데이트", "최종 수정", "연락처", "환불", "보증", "개인정보", "면책", "리뷰"], "최신성·연락처·정책 등 신뢰 신호"]
};
const WEIGHT: Record<Axis, number> = { experience: 0.25, expertise: 0.3, authoritativeness: 0.25, trustworthiness: 0.2 };
const AXES: Axis[] = ["experience", "expertise", "authoritativeness", "trustworthiness"];

function axisScore(text: string, signals: string[]): number {
  const hits = signals.reduce((n, s) => n + (text.includes(s) ? 1 : 0), 0);
  return Math.min(100, hits * 25);
}

/** E-E-A-T 4축 진단(결정적). */
export function auditEeat(content: string): EeatReport {
  const text = normalize(content);
  const scores = {} as Record<Axis, number>;
  for (const axis of AXES) scores[axis] = axisScore(text, SIGNALS[axis][0]);
  const total = pyRound(AXES.reduce((sum, a) => sum + scores[a] * WEIGHT[a], 0), 1);

  const missingSignals: string[] = [];
  const suggestions: string[] = [];
  for (const axis of AXES) {
    if (scores[axis] < 50) {
      const desc = SIGNALS[axis][1];
      missingSignals.push(desc);
      suggestions.push(`[${axis}] ${desc} 를 본문에 보강하세요 (현재 ${Math.round(scores[axis])}점)`);
    }
  }

  return {
    experience: scores.experience,
    expertise: scores.expertise,
    authoritativeness: scores.authoritativeness,
    trustworthiness: scores.trustworthiness,
    total,
    missingSignals,
    suggestions
  };
}
