/**
 * 외부 연동 상태 레지스트리.
 * 규칙: "환경 변수에 자격증명을 넣으면 켜진다." 실서버 이관 시 같은 env만 채우면 됨.
 * 이 파일이 각 연동이 현재 환경에서 설정됐는지 한곳에서 보고한다(읽기 전용).
 */
export type IntegrationCategory = "코어" | "메시지·메일" | "데이터·광고" | "결제" | "캘린더";

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
      key: "naverDatalab",
      label: "네이버 데이터랩 (검색 트렌드)",
      category: "데이터·광고",
      configured: has("NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"),
      envVars: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
      description: "키워드 검색어 트렌드",
      usedIn: "키워드·성과 분석",
      fallback: "데모 추정치"
    },
    {
      key: "naverSearchAd",
      label: "네이버 검색광고 (검색량)",
      category: "데이터·광고",
      configured: has("NAVER_AD_API_KEY", "NAVER_AD_SECRET", "NAVER_AD_CUSTOMER_ID"),
      envVars: ["NAVER_AD_API_KEY", "NAVER_AD_SECRET", "NAVER_AD_CUSTOMER_ID"],
      description: "키워드 월간 검색수",
      usedIn: "검색량 조회",
      fallback: "데이터랩/데모로 대체"
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
      label: "구글 캘린더",
      category: "캘린더",
      configured: has("GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET"),
      envVars: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET"],
      description: "일정 양방향 동기화",
      usedIn: "캘린더",
      fallback: "내부 캘린더만 사용"
    },
    {
      key: "naverCalendar",
      label: "네이버 캘린더",
      category: "캘린더",
      configured: has("NAVER_CALENDAR_CLIENT_ID", "NAVER_CALENDAR_CLIENT_SECRET"),
      envVars: ["NAVER_CALENDAR_CLIENT_ID", "NAVER_CALENDAR_CLIENT_SECRET"],
      description: "일정 양방향 동기화",
      usedIn: "캘린더",
      fallback: "내부 캘린더만 사용"
    }
  ];
}

export function isIntegrationConfigured(key: string): boolean {
  return getIntegrationStatuses().find((s) => s.key === key)?.configured ?? false;
}
