// GEO Studio · M2 CEP 파인더 — 프로브 쿼리 생성 (원본 probes.py 이식).
// 카테고리 하나에 5차원(상황/감성/시간/장소/동반자)을 자극하는 프로브 30개+ 자동 생성.

const DIMENSION_ANGLES: Record<string, string[]> = {
  situation: [
    "{category} 어떤 상황에 필요해?",
    "{category} 처음 이용할 때 뭘 봐야 해?",
    "급하게 {category} 찾을 때 어디가 좋아?",
    "{category} 실패 없이 고르는 법 알려줘"
  ],
  emotion: [
    "기분 전환하고 싶을 때 {category} 추천해줘",
    "특별한 날 만족스러운 {category} 어디야?",
    "가성비 좋으면서 후회 없는 {category} 알려줘",
    "믿고 맡길 수 있는 {category} 어디가 좋아?"
  ],
  time: [
    "주말에 이용하기 좋은 {category} 추천해줘",
    "평일 저녁에 가기 좋은 {category} 어디야?",
    "요즘 뜨는 {category} 알려줘",
    "예약 없이 바로 되는 {category} 있어?"
  ],
  place: [
    "서울에서 {category} 어디가 제일 좋아?",
    "우리 동네 근처 {category} 추천해줘",
    "지방에서도 괜찮은 {category} 알려줘",
    "접근성 좋은 {category} 어디야?"
  ],
  companion: [
    "가족과 함께하기 좋은 {category} 추천해줘",
    "혼자 이용하기 편한 {category} 어디야?",
    "친구랑 가기 좋은 {category} 알려줘",
    "아이랑 같이 가도 되는 {category} 있어?"
  ]
};

const GENERAL_ANGLES: string[] = [
  "{category} 추천 좀 해줘",
  "{category} 중에 제일 유명한 곳 어디야?",
  "{category} 잘하는 곳 3~5개 알려줘",
  "요즘 사람들이 많이 찾는 {category} 알려줘",
  "{category} 어디가 평이 좋아?",
  "{category} 고를 때 뭐가 중요해?"
];

export type Probe = { dimension: string; text: string };

/** 카테고리 하나에서 프로브 30개+ 생성. perDimension은 차원별 최대 프로브 수(최대 4). */
export function buildProbes(category: string, perDimension = 4): Probe[] {
  if (!category.trim()) throw new Error("category 는 비어 있을 수 없습니다");
  const probes: Probe[] = [];
  for (const [dim, angles] of Object.entries(DIMENSION_ANGLES)) {
    for (const tpl of angles.slice(0, Math.max(1, perDimension))) {
      probes.push({ dimension: dim, text: tpl.replaceAll("{category}", category) });
    }
  }
  for (const tpl of GENERAL_ANGLES) probes.push({ dimension: "general", text: tpl.replaceAll("{category}", category) });
  return probes;
}

/** 카테고리 + 보조 키워드로 프로브 세트를 확장. */
export function buildProbesMulti(category: string, extraKeywords?: string[], perDimension = 4): Probe[] {
  const probes = buildProbes(category, perDimension);
  for (const kw of extraKeywords ?? []) {
    if (kw.trim()) probes.push(...buildProbes(kw, 2));
  }
  return probes;
}
