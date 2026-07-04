/**
 * 토스 결제 성공 콜백 처리 (워크플로우 13차).
 * 결제창에서 돌아온 결제를 서버에서 승인(confirm)하고, 승인된 경우에만 기록한다.
 * 순수 조합 함수라 단위 테스트가 쉽다(라우트는 이 함수를 호출만 한다).
 */
import { confirmTossPayment } from "@/server/integrations/toss";
import { recordTossPayment } from "@/server/repositories/finance";

export type TossCompleteInput = {
  billingId: string;
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type TossCompleteResult =
  | { ok: true; duplicate: boolean }
  | { ok: false; reason: string };

export async function confirmAndRecordToss(input: TossCompleteInput): Promise<TossCompleteResult> {
  if (!input.paymentKey || !input.orderId || !Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "결제 정보가 올바르지 않습니다." };
  }

  let approved;
  try {
    approved = await confirmTossPayment({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      amount: input.amount
    });
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "결제 승인에 실패했습니다." };
  }

  if (!approved.approved) {
    return { ok: false, reason: "승인되지 않은 결제입니다." };
  }

  const recorded = await recordTossPayment(input.billingId, {
    amount: input.amount,
    paymentKey: approved.paymentKey,
    method: approved.method
  });

  return { ok: true, duplicate: recorded.duplicate };
}
