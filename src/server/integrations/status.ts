/**
 * 외부 연동 상태 레지스트리 (워크플로우 7차).
 *
 * 모든 외부 API 연동은 "환경 변수에 자격증명을 넣으면 켜진다"는 하나의 규칙을 따른다.
 * 실 서버로 이관해도 코드는 그대로이고, 새 환경의 env에 같은 키만 넣으면 된다.
 * 이 파일은 각 연동이 현재 환경에서 설정됐는지 한곳에서 보고한다.
 */

export type IntegrationKey =
  | "naverSearchAd"
  | "naverDatalab"
  | "kakaoLogin"
  | "kakaoAlimtalk"
  | "email"
  | "toss";

export type IntegrationStatus = {
  key: IntegrationKey;
  label: string;
  configured: boolean;
  /** 이 연동을 켜기 위해 채워야 하는 환경 변수 이름들. */
  envVars: string[];
  description: string;
  /** ERP 어디에서 쓰이는지(연동 관리 화면 안내용). */
  usedIn: string;
  /** 미연동일 때의 대체 동작. */
  fallback: string;
};

function has(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]));
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      key: "naverSearchAd",
      label: "네이버 검색광고 (검색량)",
      configured: has("NAVER_AD_API_KEY", "NAVER_AD_SECRET", "NAVER_AD_CUSTOMER_ID"),
      envVars: ["NAVER_AD_API_KEY", "NAVER_AD_SECRET", "NAVER_AD_CUSTOMER_ID"],
      description: "키워드 월간 검색수 조회",
      usedIn: "검색량 조회",
      fallback: "데모 추정치 표시"
    },
    {
      key: "naverDatalab",
      label: "네이버 데이터랩 (검색 트렌드)",
      configured: has("NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"),
      envVars: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
      description: "키워드 검색어 트렌드(상대 지표)",
      usedIn: "검색량 조회",
      fallback: "검색광고/데모로 대체"
    },
    {
      key: "kakaoLogin",
      label: "카카오 로그인",
      configured: has("AUTH_KAKAO_ID", "AUTH_KAKAO_SECRET"),
      envVars: ["AUTH_KAKAO_ID", "AUTH_KAKAO_SECRET"],
      description: "카카오 계정으로 로그인",
      usedIn: "로그인",
      fallback: "데모 로그인 사용"
    },
    {
      key: "kakaoAlimtalk",
      label: "카카오 알림톡",
      configured: has("KAKAO_ALIMTALK_API_KEY", "KAKAO_ALIMTALK_SENDER", "KAKAO_ALIMTALK_ENDPOINT"),
      envVars: ["KAKAO_ALIMTALK_API_KEY", "KAKAO_ALIMTALK_SENDER", "KAKAO_ALIMTALK_ENDPOINT"],
      description: "거래처에 알림톡 발송",
      usedIn: "보고서 알림톡",
      fallback: "발송 없이 미리보기"
    },
    {
      key: "email",
      label: "이메일 발송",
      configured: has("EMAIL_API_KEY", "EMAIL_FROM"),
      envVars: ["EMAIL_API_KEY", "EMAIL_FROM"],
      description: "보고서·안내 메일 발송",
      usedIn: "보고서 메일",
      fallback: "발송 없이 미리보기"
    },
    {
      key: "toss",
      label: "토스페이먼츠 (결제)",
      configured: has("TOSS_SECRET_KEY"),
      envVars: ["TOSS_SECRET_KEY", "TOSS_CLIENT_KEY"],
      description: "청구·결제 연동",
      usedIn: "결제 링크 (/pay)",
      fallback: "데모 결제로 동작"
    }
  ];
}

export function isIntegrationConfigured(key: IntegrationKey): boolean {
  return getIntegrationStatuses().find((status) => status.key === key)?.configured ?? false;
}
