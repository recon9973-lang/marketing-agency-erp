import { z } from "zod";

/** 공용 결제 링크 데모 결제 입력 검증 (워크플로우 10차). */
export const payBillingSchema = z.object({
  billingRecordId: z.string().trim().min(1, "청구 정보를 확인해주세요.")
});
