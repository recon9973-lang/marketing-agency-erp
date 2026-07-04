/**
 * 카카오 알림톡 발송 어댑터 (워크플로우 9차).
 *
 * 자격증명(KAKAO_ALIMTALK_*)이 env에 있으면 실제로 발송하고, 없으면 발송하지 않고
 * "미리보기"(sent=false)를 돌려준다. 키만 넣으면 실제 발송으로 바뀌며 호출부 코드는
 * 그대로다 → 실 서버 이관 시 재작업 없음.
 *
 * 알림톡은 사업자마다 제공자(카카오 비즈메시지 대행사)와 엔드포인트가 달라, 엔드포인트도
 * 환경 변수(KAKAO_ALIMTALK_ENDPOINT)로 받는다. 실제 발송에는 발신프로필과 승인된
 * 템플릿이 필요하다.
 */

export type AlimtalkMessage = {
  /** 수신자 휴대폰 번호(하이픈 무관). */
  to: string;
  /** 승인된 템플릿 이름/코드. */
  templateName: string;
  /** 최종 치환된 본문. */
  text: string;
};

export type AlimtalkResult = {
  sent: boolean;
  id: string | null;
  preview: AlimtalkMessage;
};

export function alimtalkConfigured(): boolean {
  return Boolean(
    process.env.KAKAO_ALIMTALK_API_KEY &&
      process.env.KAKAO_ALIMTALK_SENDER &&
      process.env.KAKAO_ALIMTALK_ENDPOINT
  );
}

/** 하이픈·공백 제거한 숫자만 남긴다. */
export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

export async function sendAlimtalk(message: AlimtalkMessage): Promise<AlimtalkResult> {
  const normalized: AlimtalkMessage = { ...message, to: normalizePhone(message.to) };

  if (!alimtalkConfigured()) {
    return { sent: false, id: null, preview: normalized };
  }

  const response = await fetch(process.env.KAKAO_ALIMTALK_ENDPOINT as string, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KAKAO_ALIMTALK_API_KEY as string}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      senderKey: process.env.KAKAO_ALIMTALK_SENDER,
      to: normalized.to,
      templateName: normalized.templateName,
      text: normalized.text
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`알림톡 발송 실패 (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const json = (await response.json().catch(() => ({}))) as { messageId?: string; id?: string };
  return { sent: true, id: json.messageId ?? json.id ?? null, preview: normalized };
}
