import { beforeEach, describe, expect, it, vi } from "vitest";

const confirmTossPaymentMock = vi.fn();
const recordTossPaymentMock = vi.fn();

vi.mock("@/server/integrations/toss", () => ({ confirmTossPayment: confirmTossPaymentMock }));
vi.mock("@/server/repositories/finance", () => ({ recordTossPayment: recordTossPaymentMock }));

async function load() {
  return import("@/server/payments/toss-complete");
}

const base = { billingId: "bill-1", paymentKey: "pk_1", orderId: "venom_bill-1_1", amount: 55000 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("confirmAndRecordToss", () => {
  it("records the payment when Toss approves", async () => {
    confirmTossPaymentMock.mockResolvedValue({ approved: true, paymentKey: "pk_1", method: "카드" });
    recordTossPaymentMock.mockResolvedValue({ status: "PAID", paidAmount: 55000, duplicate: false });
    const { confirmAndRecordToss } = await load();

    const result = await confirmAndRecordToss(base);

    expect(result).toEqual({ ok: true, duplicate: false });
    expect(confirmTossPaymentMock).toHaveBeenCalledWith({ paymentKey: "pk_1", orderId: base.orderId, amount: 55000 });
    expect(recordTossPaymentMock).toHaveBeenCalledWith("bill-1", { amount: 55000, paymentKey: "pk_1", method: "카드" });
  });

  it("does NOT record when Toss does not approve", async () => {
    confirmTossPaymentMock.mockResolvedValue({ approved: false, paymentKey: "pk_1", method: null });
    const { confirmAndRecordToss } = await load();

    const result = await confirmAndRecordToss(base);

    expect(result.ok).toBe(false);
    expect(recordTossPaymentMock).not.toHaveBeenCalled();
  });

  it("surfaces the confirm error without recording", async () => {
    confirmTossPaymentMock.mockRejectedValue(new Error("토스 결제 승인 실패 (400): 이미 처리된 결제입니다."));
    const { confirmAndRecordToss } = await load();

    const result = await confirmAndRecordToss(base);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("이미 처리된 결제");
    expect(recordTossPaymentMock).not.toHaveBeenCalled();
  });

  it("rejects malformed input before calling Toss", async () => {
    const { confirmAndRecordToss } = await load();

    const result = await confirmAndRecordToss({ ...base, amount: 0 });

    expect(result.ok).toBe(false);
    expect(confirmTossPaymentMock).not.toHaveBeenCalled();
  });

  it("reports duplicates as ok", async () => {
    confirmTossPaymentMock.mockResolvedValue({ approved: true, paymentKey: "pk_1", method: "카드" });
    recordTossPaymentMock.mockResolvedValue({ status: "PAID", paidAmount: 55000, duplicate: true });
    const { confirmAndRecordToss } = await load();

    const result = await confirmAndRecordToss(base);

    expect(result).toEqual({ ok: true, duplicate: true });
  });
});
