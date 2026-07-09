"use server";

/**
 * 공용 결제(/pay/[id]) server action (워크플로우 10차).
 *
 * 데모 결제: 실 결제(토스) 미연동 시에만 허용. 남은 금액을 결제 완료로 기록한다.
 * 실 결제가 설정돼 있으면 데모 결제를 막고 결제창을 쓰도록 유도한다.
 */
import { revalidatePath } from "next/cache";
import { payBillingSchema } from "@/domain/pay";
import { runAction, type ActionResult } from "@/server/action-result";
import { notFound, validationError } from "@/server/errors";
import { demoPaymentAllowed } from "@/server/integrations/toss";
import { getBillingForPayment, recordDemoPayment } from "@/server/repositories/finance";

function formDataToObject(formData: FormData) {
  const record: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

export type PayBillingState = ActionResult<{ status: string; alreadyPaid: boolean }>;

export async function payBillingDemoAction(
  _prevState: PayBillingState | null,
  formData: FormData
): Promise<PayBillingState> {
  return runAction(async () => {
    const { billingRecordId } = payBillingSchema.parse(formDataToObject(formData));

    // 데모 결제는 데모 환경에서만. 운영에서 토스 키를 빠뜨려도 결제 위조를 막는다.
    if (!demoPaymentAllowed()) {
      throw validationError("데모 결제를 사용할 수 없습니다. 실 결제창에서 결제해주세요.");
    }

    const billing = await getBillingForPayment(billingRecordId);
    if (!billing) {
      throw notFound("청구 정보를 찾을 수 없습니다.");
    }

    const result = await recordDemoPayment(billingRecordId);

    revalidatePath(`/pay/${billingRecordId}`);
    revalidatePath("/finance");
    return { status: result.status, alreadyPaid: result.alreadyPaid };
  });
}
