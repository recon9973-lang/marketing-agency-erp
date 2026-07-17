// GEO Studio · M2 CEP 파인더 — CEP → 콘텐츠 브리프 (원본 brief.py 이식). M3 입력이 됨.
import { cepTags, type Cep, type ContentBrief } from "./models";

const TYPE_DEFAULTS: Record<string, [tone: string, channel: string]> = {
  blog: ["정보형·신뢰형", "네이버 블로그 / 홈페이지"],
  sns: ["친근·감성형", "인스타그램 / 스레드"],
  faq: ["명료·실용형", "홈페이지 FAQ / GBP"],
  landing: ["설득·전환형", "랜딩페이지"]
};

const COMPANION_PERSONA: Record<string, string> = {
  "아이 동반": "어린 자녀를 둔 30~40대 부모",
  가족: "가족 단위 소비자",
  혼자: "1인 라이프 20~30대",
  친구: "친구·지인과 함께하는 20~30대",
  반려동물: "반려동물을 키우는 소비자"
};

function persona(cep: Cep): string {
  let base = COMPANION_PERSONA[cep.companionTag] ?? "카테고리 관심 소비자";
  if (cep.placeTag) base += ` · ${cep.placeTag} 지역`;
  return base;
}

function searchIntent(cep: Cep): string {
  const axes = [cep.situationTag, cep.timeTag, cep.placeTag, cep.companionTag];
  const ctx = axes.filter(Boolean).join(", ") || "일반 탐색";
  return `'${cep.cepText}' 맥락(${ctx})에서 신뢰할 만한 선택지를 찾는 의도`;
}

export function buildBrief(cep: Cep, contentType = "blog", brand = ""): ContentBrief {
  const [tone, channel] = TYPE_DEFAULTS[contentType] ?? TYPE_DEFAULTS.blog;
  const keyMessages = [
    `${cep.cepText} 상황에서 왜 이 선택이 적합한지 근거 제시`,
    "실제 이용 맥락(시간대·동반자·장소)에 맞춘 구체적 안내",
    "AI가 인용하기 좋은 사실 기반 정보(수치·후기·조건) 포함"
  ];
  if (brand) keyMessages.push(`${brand}의 차별점을 해당 CEP 맥락과 연결`);

  const outline = [
    `도입: '${cep.cepText}' 상황 공감 및 문제 정의`,
    "핵심 기준: 이 맥락에서 무엇을 봐야 하는가",
    "추천/비교: 조건별 선택지와 근거",
    "실행 가이드: 예약·방문·이용 팁",
    "마무리: 요약 + 다음 행동 유도"
  ];

  const seoRaw = [cep.cepText, ...Object.values(cepTags(cep)).filter(Boolean)];
  if (brand) seoRaw.push(brand);
  const seoKeywords = [...new Set(seoRaw)]; // 중복 제거·순서 유지(dict.fromkeys)

  return {
    cepText: cep.cepText,
    contentType,
    workingTitle: `${cep.cepText} — 이렇게 고르세요`,
    targetPersona: persona(cep),
    searchIntent: searchIntent(cep),
    keyMessages,
    outline,
    seoKeywords,
    tone,
    recommendedChannel: channel,
    cta: "상담/예약 안내 및 관련 콘텐츠 링크"
  };
}
