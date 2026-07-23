/**
 * 외부 연동 상태 레지스트리.
 * 규칙: "환경 변수에 자격증명을 넣으면 켜진다." 실서버 이관 시 같은 env만 채우면 됨.
 * 이 파일이 각 연동이 현재 환경에서 설정됐는지 한곳에서 보고한다(읽기 전용).
 */
export type IntegrationCategory = "코어" | "AI" | "메시지·메일" | "데이터·광고" | "제작·발행" | "결제" | "캘린더";

export type IntegrationStatus = {
  key: string;
  label: string;
  category: IntegrationCategory;
  configured: boolean;
  envVars: string[];
  description: string;
  usedIn: string;
  fallback: string;
};

function has(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
}
function hasAny(...names: string[]): boolean {
  return names.some((name) => Boolean(process.env[name]));
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      key: "database",
      label: "데이터베이스 (Neon Postgres)",
      category: "코어",
      configured: hasAny("DATABASE_URL_UNPOOLED", "DATABASE_URL"),
      envVars: ["DATABASE_URL_UNPOOLED", "DATABASE_URL"],
      description: "모든 데이터 저장소",
      usedIn: "ERP 전체",
      fallback: "미연결 시 로그인·저장 불가"
    },
    {
      key: "adminLogin",
      label: "관리자 로그인 (이메일+비밀번호)",
      category: "코어",
      configured: has("AUTH_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD"),
      envVars: ["AUTH_SECRET", "ADMIN_EMAIL", "ADMIN_PASSWORD"],
      description: "최고관리자 로그인(SMTP 불필요)",
      usedIn: "로그인",
      fallback: "미설정 시 로그인 폼 비활성"
    },
    {
      key: "dailyAutomation",
      label: "일일 자동화 (크론)",
      category: "코어",
      configured: has("CRON_SECRET"),
      envVars: ["CRON_SECRET"],
      description: "매일 순위감시·채널동기화·매거진초안·GEO관측 자동 실행",
      usedIn: "월보장 트래커·거래처 인사이트·매거진·GEO 모니터링",
      fallback: "미설정 시 일일 배치가 401로 미실행(자동 데이터 갱신 멈춤)"
    },
    {
      key: "bootstrapLockdown",
      label: "부트스트랩 백도어 차단 (운영 보안)",
      category: "코어",
      // 보안 항목 — "차단됨"이 정상. 운영에선 반드시 켜야 한다.
      configured: /^(1|true|yes|on)$/i.test(process.env.DISABLE_BOOTSTRAP_ADMIN ?? ""),
      envVars: ["DISABLE_BOOTSTRAP_ADMIN"],
      description: "초기 설치용 공용 관리자(admin@venom.app) 로그인 차단",
      usedIn: "로그인 보안",
      fallback: "미설정 시 공용 부트스트랩 계정으로 로그인 가능 — 운영 전환 시 반드시 DISABLE_BOOTSTRAP_ADMIN=true"
    },
    {
      key: "claudeAi",
      label: "Claude AI (콘텐츠 생성)",
      category: "AI",
      configured: has("ANTHROPIC_API_KEY"),
      envVars: ["ANTHROPIC_API_KEY"],
      description: "블로그·카드뉴스·SNS·광고 문구 자동 생성",
      usedIn: "AI 마케팅 엔진",
      fallback: "미설정 시 생성 폼만 미리보기"
    },
    {
      key: "imageGen",
      label: "이미지 생성 (OpenAI)",
      category: "AI",
      configured: has("OPENAI_API_KEY"),
      envVars: ["OPENAI_API_KEY", "OPENAI_IMAGE_MODEL"],
      description: "원고 스튜디오에서 이미지/카드뉴스 이미지 생성",
      usedIn: "원고 스튜디오 · 이미지 엔진",
      fallback: "미설정 시 프롬프트만 복사해 외부 툴 사용"
    },
    {
      key: "speechToText",
      label: "음성 → 텍스트 (OpenAI Whisper)",
      category: "AI",
      configured: has("OPENAI_API_KEY"),
      envVars: ["OPENAI_API_KEY", "OPENAI_TRANSCRIBE_MODEL"],
      description: "회의 녹음을 텍스트로 전사(회의록)",
      usedIn: "회의록",
      fallback: "미설정 시 메모 붙여넣기로 회의록 생성"
    },
    {
      key: "emailMagicLink",
      label: "직원 이메일 매직링크",
      category: "메시지·메일",
      configured: has("EMAIL_SERVER", "EMAIL_FROM"),
      envVars: ["EMAIL_SERVER", "EMAIL_FROM"],
      description: "직원에게 로그인 링크 메일 발송",
      usedIn: "로그인(직원)",
      fallback: "관리자 비밀번호 로그인만 사용"
    },
    {
      key: "kakaoAlimtalk",
      label: "카카오 알림톡",
      category: "메시지·메일",
      configured: has("KAKAO_ALIMTALK_API_KEY", "KAKAO_ALIMTALK_SENDER", "KAKAO_ALIMTALK_ENDPOINT"),
      envVars: ["KAKAO_ALIMTALK_API_KEY", "KAKAO_ALIMTALK_SENDER", "KAKAO_ALIMTALK_ENDPOINT"],
      description: "거래처에 알림톡 발송",
      usedIn: "보고서 알림",
      fallback: "발송 없이 미리보기"
    },
    {
      key: "sgisPopulation",
      label: "SGIS 인구통계 (통계청)",
      category: "데이터·광고",
      configured: has("SGIS_CONSUMER_KEY", "SGIS_CONSUMER_SECRET"),
      envVars: ["SGIS_CONSUMER_KEY", "SGIS_CONSUMER_SECRET"],
      description: "지역(시군구/읍면동) 인구·평균연령·세대수·인구밀도를 API로 실측 (상권분석)",
      usedIn: "상권분석·거래처 인사이트(인구 축)",
      fallback: "미설정 시 총계·원자료 업로드로 대체"
    },
    {
      key: "regionData",
      label: "상권 실측 데이터 (행안부·심평원)",
      category: "데이터·광고",
      configured: true,
      envVars: [],
      description: "행안부 주민등록(인구·성별·증감) + 심평원 병원정보(밀집도·좌표)·상병통계를 내장 데이터셋으로 실측 (키 불필요)",
      usedIn: "상권분석(/market)·거래처 인사이트",
      fallback: "상시 내장 — data/ 원본 갱신 시 scripts/build-region-data.py 재실행"
    },
    {
      key: "geoEngines",
      label: "AI 답변 엔진 (GEO 자동 관측)",
      category: "데이터·광고",
      configured: Boolean(
        process.env.OPENAI_API_KEY || process.env.PERPLEXITY_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.ANTHROPIC_API_KEY
      ),
      envVars: ["OPENAI_API_KEY", "PERPLEXITY_API_KEY", "GOOGLE_AI_API_KEY", "ANTHROPIC_API_KEY"],
      description: "승인 질문을 공식 API로 자동 실행해 병원 언급·인용을 기록 (키가 있는 엔진만 사용, 주 1회+수동)",
      usedIn: "GEO 모니터링·월간 리포트",
      fallback: "수동 관측 기록"
    },
    {
      key: "googleData",
      label: "구글 GSC·GA4 (검색·방문 지표)",
      category: "데이터·광고",
      configured: has("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"),
      envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
      description: "Search Console 노출·클릭 + GA4 세션 일일 수집 (거래처 상세에서 계정 연결)",
      usedIn: "거래처 인사이트·월간 리포트",
      fallback: "수기 입력/미표시"
    },
    {
      key: "naverDatalab",
      label: "네이버 데이터랩 (검색 트렌드)",
      category: "데이터·광고",
      configured: has("NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"),
      envVars: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
      description: "키워드 검색어 트렌드",
      usedIn: "키워드·성과 분석 · GEO Studio(CEP)",
      fallback: "데모 추정치"
    },
    {
      key: "naverSearchAd",
      label: "네이버 검색광고 (검색량)",
      category: "데이터·광고",
      configured: has("NAVER_AD_API_KEY", "NAVER_AD_SECRET", "NAVER_AD_CUSTOMER_ID"),
      envVars: ["NAVER_AD_API_KEY", "NAVER_AD_SECRET", "NAVER_AD_CUSTOMER_ID"],
      description: "키워드 월간 검색수",
      usedIn: "검색량 조회 · 컨설팅·인사이트 · GEO Studio(CEP)",
      fallback: "데이터랩/데모로 대체"
    },
    {
      key: "naverLocal",
      label: "네이버 지역검색 (경쟁사 플레이스)",
      category: "데이터·광고",
      configured: has("NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"),
      envVars: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
      description: "지역+진료과 경쟁사 상위 표본(플레이스) — 상권분석 경쟁 축",
      usedIn: "상권분석(/market) 경쟁사",
      fallback: "미설정 시 경쟁사 표본 미표시(밀집도는 심평원으로 대체)"
    },
    {
      key: "toss",
      label: "토스페이먼츠 (결제)",
      category: "결제",
      configured: has("TOSS_SECRET_KEY"),
      envVars: ["TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"],
      description: "청구·결제 연동",
      usedIn: "정산/결제",
      fallback: "데모 결제로 동작"
    },
    {
      key: "googleCalendar",
      label: "구글 캘린더 (준비중)",
      category: "캘린더",
      // 동기화 코드 미구현 — env가 있어도 아직 동작하지 않으므로 항상 미연결로 정직 표시.
      configured: false,
      envVars: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET"],
      description: "일정 양방향 동기화 (동기화 미구현 · 예정)",
      usedIn: "캘린더",
      fallback: "내부 캘린더만 사용"
    },
    {
      key: "naverCalendar",
      label: "네이버 캘린더 (준비중)",
      category: "캘린더",
      // 동기화 코드 미구현 — 항상 미연결로 정직 표시.
      configured: false,
      envVars: ["NAVER_CALENDAR_CLIENT_ID", "NAVER_CALENDAR_CLIENT_SECRET"],
      description: "일정 양방향 동기화 (동기화 미구현 · 예정)",
      usedIn: "캘린더",
      fallback: "내부 캘린더만 사용"
    },
    {
      key: "wordpress",
      label: "워드프레스 (발행)",
      category: "제작·발행",
      configured: has("WORDPRESS_SITE_URL", "WORDPRESS_USER", "WORDPRESS_APP_PASSWORD"),
      envVars: ["WORDPRESS_SITE_URL", "WORDPRESS_USER", "WORDPRESS_APP_PASSWORD"],
      description: "콘텐츠·매거진을 워드프레스로 발행/예약",
      usedIn: "콘텐츠 플랜 · 매거진 발행",
      fallback: "발행 없이 초안만 저장"
    },
    {
      key: "makeWebhook",
      label: "Make 웹훅 (멀티채널 발행)",
      category: "제작·발행",
      configured: has("MAKE_WEBHOOK_URL"),
      envVars: ["MAKE_WEBHOOK_URL"],
      description: "블로그·인스타·플레이스 자동 발행 오케스트레이션",
      usedIn: "마케팅 발행",
      fallback: "수동 발행"
    },
    {
      key: "seoGenerator",
      label: "SEO 콘텐츠 생성기",
      category: "제작·발행",
      configured: has("SEO_GENERATOR_URL"),
      envVars: ["SEO_GENERATOR_URL"],
      description: "외부 SEO 원고 생성 파이프라인",
      usedIn: "콘텐츠 파이프라인",
      fallback: "내부 생성으로 대체"
    },
    {
      key: "higgsfield",
      label: "Higgsfield (이미지·영상)",
      category: "제작·발행",
      configured: has("HIGGSFIELD_API_URL", "HIGGSFIELD_API_KEY"),
      envVars: ["HIGGSFIELD_API_URL", "HIGGSFIELD_API_KEY"],
      description: "크리에이티브 이미지/영상·바이럴 예측",
      usedIn: "마케팅 스튜디오",
      fallback: "미연결 시 기능 숨김"
    },
    {
      key: "canva",
      label: "Canva Connect (디자인)",
      category: "제작·발행",
      configured: has("CANVA_ACCESS_TOKEN"),
      envVars: ["CANVA_ACCESS_TOKEN"],
      description: "브랜드 템플릿 기반 디자인 생성",
      usedIn: "디자인 스튜디오",
      fallback: "미연결 시 기능 숨김"
    },
    {
      key: "naverResearch",
      label: "네이버 리서치 (연관어·노출순위)",
      category: "데이터·광고",
      configured: has("NAVER_SEARCH_CLIENT_ID", "NAVER_SEARCH_CLIENT_SECRET"),
      envVars: ["NAVER_SEARCH_CLIENT_ID", "NAVER_SEARCH_CLIENT_SECRET"],
      description: "연관 키워드·검색 노출 순위 수집(데이터랩 키와 별개 자격증명)",
      usedIn: "거래처 노출 추적 · 키워드 리서치",
      fallback: "수집 없음(미노출 표시)"
    },
    {
      key: "s3Storage",
      label: "에셋 저장소 (S3 호환)",
      category: "코어",
      configured: has("STUDIO_S3_BUCKET", "STUDIO_S3_ACCESS_KEY_ID", "STUDIO_S3_SECRET_ACCESS_KEY"),
      envVars: ["STUDIO_S3_BUCKET", "STUDIO_S3_ACCESS_KEY_ID", "STUDIO_S3_SECRET_ACCESS_KEY"],
      description: "스튜디오 이미지·파일 업로드 저장",
      usedIn: "이미지·자료 스튜디오",
      fallback: "미연결 시 업로드 비활성"
    }
  ];
}

export function isIntegrationConfigured(key: string): boolean {
  return getIntegrationStatuses().find((s) => s.key === key)?.configured ?? false;
}
