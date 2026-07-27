import "server-only";
/**
 * 상권 종합 스코어카드 — 이미 수집된 축(인구·밀집도·개원·성장)을 규칙 기반으로 합성해
 * 등급(A~D)·부문 점수·강점/약점을 산출한다. 새 데이터 없이 "분석 → 판단"으로 전환.
 * 모든 점수는 마케팅 기회 관점(높을수록 유리). 실측 데이터에 근거하며 날조하지 않는다.
 */
import type { HospitalSummary, RegionPopulation, Openings } from "@/server/data/region-insight";

export type ScoreSub = { key: string; label: string; score: number; note: string };
export type Scorecard = {
  overall: number;
  grade: "A" | "B" | "C" | "D";
  subs: ScoreSub[];
  strengths: string[];
  weaknesses: string[];
};

function clamp(n: number, lo = 5, hi = 95): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
function gradeOf(n: number): "A" | "B" | "C" | "D" {
  return n >= 78 ? "A" : n >= 63 ? "B" : n >= 48 ? "C" : "D";
}

export type ScorecardInput = {
  population: RegionPopulation | null;
  hospitals: HospitalSummary | null;
  openings: Openings | null;
  nationalPer: number;
};

export function buildScorecard(input: ScorecardInput): Scorecard | null {
  const { population, hospitals, openings, nationalPer } = input;
  if (!population && !hospitals) return null;

  const subs: ScoreSub[] = [];

  // ① 경쟁 여유도 — 만명당 병원 밀도(전국 대비) + 최근 개원. 낮을수록(여유) 높은 점수.
  let compScore = 55;
  let compNote = "밀도 데이터 없음";
  if (hospitals?.perTenThousand != null && nationalPer) {
    const ratio = hospitals.perTenThousand / nationalPer;
    // ratio 0.7→88, 1.0→60, 1.3→38, 1.6→20 (선형 근사)
    compScore = 88 - (ratio - 0.7) * (68 / 0.9);
    const dense = ratio >= 1.2 ? "과밀" : ratio <= 0.8 ? "여유" : "평균";
    compNote = `만명당 ${hospitals.perTenThousand}개(전국 ${nationalPer}, ${dense})`;
    if (openings) {
      if (openings.y1 >= 30) {
        compScore -= 14;
        compNote += ` · 최근 개원 ${openings.y1}곳(진입 활발)`;
      } else if (openings.y1 <= 3) {
        compScore += 6;
        compNote += ` · 개원 ${openings.y1}곳(안정)`;
      } else {
        compNote += ` · 개원 ${openings.y1}곳`;
      }
    }
  }
  subs.push({ key: "competition", label: "경쟁 여유도", score: clamp(compScore), note: compNote });

  // ② 수요 규모 — 상권 인구 규모.
  let demandScore = 40;
  let demandNote = "인구 데이터 없음";
  if (population?.total) {
    const p = population.total;
    demandScore = p >= 400000 ? 88 : p >= 250000 ? 74 : p >= 150000 ? 62 : p >= 80000 ? 48 : 32;
    demandNote = `상권 인구 ${p.toLocaleString("ko-KR")}명`;
  }
  subs.push({ key: "demand", label: "수요 규모", score: clamp(demandScore), note: demandNote });

  // ③ 성장 모멘텀 — 전월 인구 증감(연환산 근사).
  let growthScore = 50;
  let growthNote = "증감 데이터 없음";
  if (population?.total) {
    const annPct = (population.delta / population.total) * 100 * 12;
    growthScore = annPct >= 2 ? 86 : annPct >= 0.5 ? 70 : annPct >= 0 ? 58 : annPct >= -1 ? 44 : 30;
    growthNote = `전월 ${population.delta >= 0 ? "▲" : "▼"}${Math.abs(population.delta).toLocaleString("ko-KR")}(연환산 ${annPct >= 0 ? "+" : ""}${Math.round(annPct * 10) / 10}%)`;
  }
  subs.push({ key: "growth", label: "성장 모멘텀", score: clamp(growthScore), note: growthNote });

  // 종합 — 경쟁 40% · 수요 35% · 성장 25% (인덱스 대신 키 조회 — push 순서가 바뀌어도 안전)
  const scoreOf = (key: string) => subs.find((s) => s.key === key)?.score ?? 0;
  const overall = Math.round(scoreOf("competition") * 0.4 + scoreOf("demand") * 0.35 + scoreOf("growth") * 0.25);
  const grade = gradeOf(overall);

  // 강점/약점 — 부문 점수 상·하위로 도출
  const sorted = [...subs].sort((a, b) => b.score - a.score);
  const strengths = sorted.filter((s) => s.score >= 65).map((s) => `${s.label} 우수 — ${s.note}`);
  const weaknesses = sorted.filter((s) => s.score < 50).map((s) => `${s.label} 취약 — ${s.note}`);
  if (!strengths.length) strengths.push(`${sorted[0].label} 상대 강점 — ${sorted[0].note}`);
  if (!weaknesses.length) weaknesses.push(`${sorted[sorted.length - 1].label} 상대 약점 — ${sorted[sorted.length - 1].note}`);

  return { overall, grade, subs, strengths, weaknesses };
}
