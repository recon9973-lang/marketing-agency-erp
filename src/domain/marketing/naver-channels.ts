// src/domain/marketing/naver-channels.ts
//
// 네이버 10채널 택소노미 + 실행 플레이북(정적 상수, 편집형 참고자료 — 트랜잭션 데이터 아님).
// geo-channels.ts의 GEO_CHANNEL_PLAYBOOK 패턴을 그대로 본떴다.
// Keyword.channel(String)은 스키마 변경 없이 이 값 집합으로 통제한다.
// 배열 순서 = 네이버 검색결과 노출 우선순위(파워링크→VIEW→플레이스→…).

export const NAVER_CHANNELS = [
  "powerlink",
  "blog",
  "cafe",
  "place",
  "influencer",
  "image",
  "kin",
  "video",
  "web",
  "tistory"
] as const;

export type NaverChannel = (typeof NAVER_CHANNELS)[number];

export const naverChannelLabels: Record<NaverChannel, string> = {
  powerlink: "파워링크(광고)",
  blog: "네이버 블로그",
  cafe: "네이버 카페",
  place: "네이버 플레이스",
  influencer: "인플루언서",
  image: "이미지",
  kin: "지식iN",
  video: "동영상",
  web: "자체 웹도메인",
  tistory: "티스토리"
};

export type NaverChannelPlay = {
  channel: NaverChannel;
  order: number; // 노출 우선순위(1=최상)
  expectedWeeksMin: number; // 상위노출 예상 최소 주
  expectedWeeksMax: number; // 최대 주(웹도메인은 개월→주 환산)
  weeklySlots: number; // 주간 권장 발행 수(0=상시/광고성)
  difficulty: "low" | "medium" | "high";
  formats: string[]; // 콘텐츠 포맷
  note: string;
};

// 근거: naver_seo_workflow(노출순서·예상기간) + naver_channel_strategy(발행빈도·포맷).
export const NAVER_CHANNEL_PLAYBOOK: NaverChannelPlay[] = [
  { channel: "powerlink", order: 1, expectedWeeksMin: 0, expectedWeeksMax: 0, weeklySlots: 0, difficulty: "low", formats: ["검색광고 소재"], note: "즉시 노출·비용형. 핵심 상업 키워드 단기 방어." },
  { channel: "blog", order: 2, expectedWeeksMin: 1, expectedWeeksMax: 4, weeklySlots: 5, difficulty: "medium", formats: ["정보글", "후기/체험", "비교/선택", "질문형 롱테일"], note: "VIEW 핵심 노출면. C-RANK+AI TOPIC 이중 알고리즘, 주제 전문화·꾸준한 루틴." },
  { channel: "cafe", order: 3, expectedWeeksMin: 2, expectedWeeksMax: 8, weeklySlots: 2, difficulty: "medium", formats: ["정보 공유", "Q&A", "후기"], note: "VIEW 보조 노출. 커뮤니티 신뢰·바이럴." },
  { channel: "place", order: 4, expectedWeeksMin: 2, expectedWeeksMax: 6, weeklySlots: 1, difficulty: "medium", formats: ["업체정보 최적화", "소식/이벤트", "리뷰 유도"], note: "지역 업체 필수(상위 3개). NAP 일관성·리뷰·사진." },
  { channel: "influencer", order: 5, expectedWeeksMin: 2, expectedWeeksMax: 8, weeklySlots: 0, difficulty: "high", formats: ["협찬 콘텐츠", "체험단"], note: "고신뢰 브랜딩. 의료광고 심의 주의." },
  { channel: "image", order: 6, expectedWeeksMin: 1, expectedWeeksMax: 3, weeklySlots: 2, difficulty: "low", formats: ["인포그래픽", "시술/서비스 이미지"], note: "이미지탭 노출. 키워드 파일명·대체텍스트." },
  { channel: "kin", order: 7, expectedWeeksMin: 0, expectedWeeksMax: 2, weeklySlots: 2, difficulty: "low", formats: ["질문", "전문가 답변"], note: "질문형 키워드 장기 노출. GEO 트랙과 공유." },
  { channel: "video", order: 8, expectedWeeksMin: 1, expectedWeeksMax: 3, weeklySlots: 1, difficulty: "medium", formats: ["숏폼", "정보 영상"], note: "유튜브+네이버TV 연동. 동영상탭." },
  { channel: "web", order: 9, expectedWeeksMin: 12, expectedWeeksMax: 52, weeklySlots: 1, difficulty: "high", formats: ["랜딩", "진료과 페이지", "FAQ"], note: "자체 도메인 SEO(장기). GEO/AEO 자산과 결합." },
  { channel: "tistory", order: 10, expectedWeeksMin: 4, expectedWeeksMax: 12, weeklySlots: 2, difficulty: "medium", formats: ["정보글", "백링크 허브"], note: "구글 SEO 보조·백링크. 네이버 노출은 제한적." }
];

export function isNaverChannel(v: unknown): v is NaverChannel {
  return typeof v === "string" && (NAVER_CHANNELS as readonly string[]).includes(v);
}

/** 채널 노출 순서로 정렬(플레이북 order 기준). */
export function naverChannelsByPriority(): NaverChannelPlay[] {
  return [...NAVER_CHANNEL_PLAYBOOK].sort((a, b) => a.order - b.order);
}
