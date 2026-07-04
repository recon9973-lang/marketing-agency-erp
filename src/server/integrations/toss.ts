/**
 * 토스페이먼츠 결제 어댑터 (워크플로우 10차).
 *
 * TOSS_SECRET_KEY가 env에 있으면 실제 결제 승인 API를 호출한다. 결제창(위젯)은
 * TOSS_CLIENT_KEY로 프런트에서 뜬다. 둘 다 없으면 "데모 결제"로 동작한다.
 * 키만 넣으면 실제 결제로 바뀌며 호출부 코드는 그대로다 → 실 서버 이관 시 재작업 없음.
 *
 * 승인 API(문서): POST https://api.tosspayments.com/v1/payments/confirm
 * 인증: Basic base64("{시크릿키}:")  (비밀번호는 비움)
 */

const CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

export function tossConfigured(): boolean {
  return Boolean(process.env.TOSS_SECRET_KEY);
}

/** 프런트 결제창(위젯)에 쓰는 공개 클라이언트 키. 없으면 null. */
export function tossClientKey(): string | null {
  return process.env.TOSS_CLIENT_KEY || null;
}

export type TossConfirmInput = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type TossConfirmResult = {
  approved: boolean;
  paymentKey: string;
  method: string | null;
  approvedAt: string | null;
};

/** 결제창에서 받은 결제를 서버에서 최종 승인한다(실 결제). */
export async function confirmTossPayment(input: TossConfirmInput): Promise<TossConfirmResult> {
  if (!tossConfigured()) {
    throw new Error("토스 결제가 설정되지 않았습니다.");
  }

  const auth = Buffer.from(`${process.env.TOSS_SECRET_KEY as string}:`).toString("base64");
  const response = await fetch(CONFIRM_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const json = (await response.json().catch(() => ({}))) as {
    status?: string;
    paymentKey?: string;
    method?: string;
    approvedAt?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(`토스 결제 승인 실패 (${response.status})${json.message ? `: ${json.message}` : ""}`);
  }

  return {
    approved: json.status === "DONE",
    paymentKey: json.paymentKey ?? input.paymentKey,
    method: json.method ?? null,
    approvedAt: json.approvedAt ?? null
  };
}
