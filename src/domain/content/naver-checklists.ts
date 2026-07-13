// src/domain/content/naver-checklists.ts
//
// 채널별 발행 전 체크리스트(naver_channel_strategy). 정적 상수 — 발행 검수 UI/게이트 참고자료.
// 블로그는 C-RANK/AI TOPIC 최적화 25항목(그룹별), 플레이스·지식iN은 핵심 항목.
// auto:true 항목은 원고에서 기계적으로 검증 가능(글자수·이미지수·키워드 위치 등).

export type ChecklistItem = { label: string; hint: string; auto?: boolean };
export type ChannelChecklist = { channel: string; groups: Array<{ title: string; items: ChecklistItem[] }> };

export const BLOG_CHECKLIST: ChannelChecklist = {
  channel: "blog",
  groups: [
    {
      title: "제목 최적화",
      items: [
        { label: "핵심 키워드가 앞 10자 이내", hint: "검색 미리보기에서 잘리지 않는 위치", auto: true },
        { label: "제목 총 길이 30~45자", hint: "모바일 전체 노출 길이", auto: true },
        { label: "감성/정보 수식어 1개 이상", hint: "솔직후기·비용총정리·꼭알아야할·추천 등" },
        { label: "숫자 포함(클릭률 ↑)", hint: '예) "3년다닌", "5곳 비교", "비용 총정리"', auto: true }
      ]
    },
    {
      title: "본문 최적화",
      items: [
        { label: "첫 200자에 핵심 키워드 2~3회", hint: "검색 스니펫 최적화 구간", auto: true },
        { label: "소제목(H태그)에 서브 키워드", hint: "AI TOPIC 구조 점수" },
        { label: "키워드 자연 밀도 2~4%", hint: "과다 삽입=스팸 필터(5회+ 반복 금지)", auto: true },
        { label: "표·리스트·박스 혼합", hint: "체류시간 증가 = C-RANK 신호" },
        { label: "글자수 최소 1,500자(A등급 3,000자+)", hint: "품질 기준선", auto: true }
      ]
    },
    {
      title: "이미지 & 태그",
      items: [
        { label: "이미지 최소 5장(A등급 10장)", hint: "체류시간 증가", auto: true },
        { label: "이미지 파일명 = 키워드 포함", hint: "강남피부과-여드름치료-1.jpg 형식(이미지탭 노출)" },
        { label: "대표 이미지 1200x630px 이상", hint: "썸네일 선명도 = 클릭률" },
        { label: "태그 20개: 핵심+연관+지역", hint: "태그별 추가 유입" },
        { label: "내부 링크 2~3개", hint: "관련 이전 포스팅 연결" }
      ]
    }
  ]
};

export const PLACE_CHECKLIST: ChannelChecklist = {
  channel: "place",
  groups: [
    {
      title: "플레이스 최적화",
      items: [
        { label: "업체명·주소·전화(NAP) 일관성", hint: "홈페이지·블로그·디렉터리와 동일" },
        { label: "대표 키워드 포함 업체 설명", hint: "지역+진료과" },
        { label: "사진 10장 이상·진료과별", hint: "내부/시술/의료진" },
        { label: "리뷰 유도(비유인성)", hint: "의료광고법: 대가성·유인 리뷰 금지" },
        { label: "영업시간·편의정보 최신화", hint: "예약/길찾기 전환" }
      ]
    }
  ]
};

export const KIN_CHECKLIST: ChannelChecklist = {
  channel: "kin",
  groups: [
    {
      title: "지식iN 최고답변 공식",
      items: [
        { label: "질문 의도에 직접 답(BLUF)", hint: "첫 문장에 결론" },
        { label: "근거·출처 명시", hint: "전문성 신호(의료진)" },
        { label: "과장·단정·유인 표현 배제", hint: "의료광고법 준수" },
        { label: "질문형 롱테일 키워드 커버", hint: "장기 노출" }
      ]
    }
  ]
};

export const NAVER_CHECKLISTS: Record<string, ChannelChecklist> = {
  blog: BLOG_CHECKLIST,
  place: PLACE_CHECKLIST,
  kin: KIN_CHECKLIST
};
