import { HospitalProfile } from "./types";

// §9.1 시드 확장: 규칙 템플릿 기반 (지역 결합 / 브랜드 결합 / 여정 유도어)
export function expandSeeds(mainKeyword: string, profile: HospitalProfile): string[] {
  const K = mainKeyword.trim();
  if (!K) return [];
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t && !out.some((o) => o.replace(/\s+/g, "") === t.replace(/\s+/g, ""))) out.push(t);
  };

  // 여정 유도어 (단계별 최소 2개 균형)
  push(`${K} 원인`); // 탐색
  push(`${K} 증상`);
  push(`${K} 종류`); // 비교
  push(`${K} 가격`);
  push(`${K} 후기`);
  push(`${K} 부작용`);
  push(`${K} 후 관리`); // 유지
  push(`${K} 주의사항`);

  // 지역 결합 (결정)
  if (profile.regionSigungu) push(`${profile.regionSigungu} ${K}`);
  if (profile.regionDong) push(`${profile.regionDong} ${K}`);
  if (profile.regionSigungu) push(`${profile.regionSigungu} ${K} 잘하는 곳`);

  // 브랜드 결합 (결정)
  if (profile.name) {
    push(`${profile.name} 후기`);
    push(`${profile.name} 예약`);
    push(`${profile.name} ${K}`);
  }

  // 주력 시술 결합
  for (const t of profile.mainTreatments.slice(0, 2)) {
    if (t && t !== K) push(`${t} ${K}`);
  }

  // 경쟁 병원 (비교·방어)
  for (const c of profile.competitors.slice(0, 2)) {
    if (c) push(`${c} 후기`);
  }

  return out.slice(0, 15);
}
