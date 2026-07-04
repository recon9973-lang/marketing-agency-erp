/**
 * 외부 연동 상태 레지스트리 (워크플로우 7차).
 *
 * 모든 외부 API 연동은 "환경 변수에 자격증명을 넣으면 켜진다"는 하나의 규칙을 따른다.
 * 실 서버로 이관해도 코드는 그대로이고, 새 환경의 env에 같은 키만 넣으면 된다.
 * 이 파일은 각 연동이 현재 환경에서 설정됐는지 한곳에서 보고한다.
 */

export type IntegrationKey = "naverSearchAd" | "kakaoLogin" | "email" | "toss";

export type IntegrationStatus = {
  key: IntegrationKey;
  label: string;
  configured: boolean;
  /** 이 연동을 켜기 위해 채워야 하는 환경 변수 이름들. */
  envVars: string[];
  description: string;
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
      description: "키워드 월간 검색수 조회"
    },
    {
      key: "kakaoLogin",
      label: "카카오 로그인",
      configured: has("AUTH_KAKAO_ID", "AUTH_KAKAO_SECRET"),
      envVars: ["AUTH_KAKAO_ID", "AUTH_KAKAO_SECRET"],
      description: "카카오 계정으로 로그인"
    },
    {
      key: "email",
      label: "이메일 발송",
      configured: has("EMAIL_API_KEY", "EMAIL_FROM"),
      envVars: ["EMAIL_API_KEY", "EMAIL_FROM"],
      description: "보고서·안내 메일 발송"
    },
    {
      key: "toss",
      label: "토스페이먼츠 (결제)",
      configured: has("TOSS_SECRET_KEY"),
      envVars: ["TOSS_SECRET_KEY"],
      description: "청구·결제 연동"
    }
  ];
}

export function isIntegrationConfigured(key: IntegrationKey): boolean {
  return getIntegrationStatuses().find((status) => status.key === key)?.configured ?? false;
}
