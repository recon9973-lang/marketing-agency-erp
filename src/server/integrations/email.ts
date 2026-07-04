/**
 * 이메일 발송 어댑터 (워크플로우 8차).
 *
 * 자격증명(EMAIL_API_KEY, EMAIL_FROM)이 env에 있으면 실제로 발송하고,
 * 없으면 발송하지 않고 "미리보기"(sent=false)를 돌려준다. 키만 넣으면 실제 발송으로
 * 바뀌며 호출부 코드는 그대로다 → 실 서버 이관 시 재작업 없음.
 *
 * 기본 제공자: Resend (https://api.resend.com/emails, Bearer 인증). 제공자를 바꿔도
 * 이 파일만 교체하면 된다.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailResult = {
  /** 실제로 발송됐는지. 미연동이면 false(미리보기). */
  sent: boolean;
  id: string | null;
  /** 발송했거나 발송했을 내용(미리보기 표시용). */
  preview: EmailMessage;
};

export function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!emailConfigured()) {
    return { sent: false, id: null, preview: message };
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EMAIL_API_KEY as string}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`이메일 발송 실패 (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const json = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: json.id ?? null, preview: message };
}
