import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/server/errors";
import { expectFail, expectOk } from "../helpers/action-result";

const getBillingForPaymentMock = vi.fn();
const recordDemoPaymentMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/repositories/finance", () => ({
  getBillingForPayment: getBillingForPaymentMock,
  recordDemoPayment: recordDemoPaymentMock
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/pay");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TOSS_SECRET_KEY", ""); // 실 결제 미연동
  vi.stubEnv("AUTH_DEMO_LOGIN", "true"); // 데모 환경 → 데모 결제 허용
  getBillingForPaymentMock.mockResolvedValue({ id: "bill-1", outstanding: 55000 });
  recordDemoPaymentMock.mockResolvedValue({ status: "PAID", paidAmount: 55000, alreadyPaid: false });
});

afterEach(() => vi.unstubAllEnvs());

describe("payBillingDemoAction", () => {
  it("records a demo payment in a demo environment", async () => {
    const { payBillingDemoAction } = await loadActions();

    const result = await payBillingDemoAction(null, formData({ billingRecordId: "bill-1" }));

    expect(expectOk(result)).toEqual({ status: "PAID", alreadyPaid: false });
    expect(recordDemoPaymentMock).toHaveBeenCalledWith("bill-1");
  });

  it("is blocked when real Toss payment is configured", async () => {
    vi.stubEnv("TOSS_SECRET_KEY", "test_sk");
    const { payBillingDemoAction } = await loadActions();

    expectFail(await payBillingDemoAction(null, formData({ billingRecordId: "bill-1" })), ErrorCode.VALIDATION_ERROR);
    expect(recordDemoPaymentMock).not.toHaveBeenCalled();
  });

  it("is blocked outside a demo environment even without Toss keys", async () => {
    vi.stubEnv("AUTH_DEMO_LOGIN", ""); // 운영: 데모 로그인 꺼짐
    const { payBillingDemoAction } = await loadActions();

    expectFail(await payBillingDemoAction(null, formData({ billingRecordId: "bill-1" })), ErrorCode.VALIDATION_ERROR);
    expect(recordDemoPaymentMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for an unknown billing id", async () => {
    getBillingForPaymentMock.mockResolvedValue(null);
    const { payBillingDemoAction } = await loadActions();

    expectFail(await payBillingDemoAction(null, formData({ billingRecordId: "ghost" })), ErrorCode.NOT_FOUND);
  });
});
