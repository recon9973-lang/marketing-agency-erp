import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ExpenseReviewStatus, PaymentMethod } from "@/domain/types";
import { ErrorCode } from "@/server/errors";
import { adminUser, marketerUser, superAdminUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const loadAccessScopesMock = vi.fn();
const getClientAccessInfoMock = vi.fn();
const createBillingRecordMock = vi.fn();
const updateBillingRecordMock = vi.fn();
const getBillingAccessInfoMock = vi.fn();
const getBillingDetailMock = vi.fn();
const recordPaymentMock = vi.fn();
const createExpenseRecordMock = vi.fn();
const getExpenseAccessInfoMock = vi.fn();
const reviewExpenseRecordMock = vi.fn();
const writeAuditLogMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));
vi.mock("@/server/repositories/clients", () => ({ getClientAccessInfo: getClientAccessInfoMock }));
vi.mock("@/server/repositories/finance", () => ({
  createBillingRecord: createBillingRecordMock,
  updateBillingRecord: updateBillingRecordMock,
  getBillingAccessInfo: getBillingAccessInfoMock,
  getBillingDetail: getBillingDetailMock,
  recordPayment: recordPaymentMock,
  createExpenseRecord: createExpenseRecordMock,
  getExpenseAccessInfo: getExpenseAccessInfoMock,
  reviewExpenseRecord: reviewExpenseRecordMock
}));
vi.mock("@/server/audit", async () => {
  const actual = await vi.importActual<typeof import("@/server/audit")>("@/server/audit");
  return { ...actual, writeAuditLog: writeAuditLogMock };
});
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/finance");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

const validBilling = { clientId: "c1", billingMonth: "2026-06-01", contractAmount: "1000000", issuedAmount: "1000000" };

beforeEach(() => {
  vi.clearAllMocks();
  loadAccessScopesMock.mockResolvedValue([]);
  writeAuditLogMock.mockResolvedValue(true);
});

describe("createBillingRecordAction", () => {
  it("creates billing for an accessible client", async () => {
    const { createBillingRecordAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue({ id: "c1", assignedMarketerId: null });
    createBillingRecordMock.mockResolvedValue({ id: "bill-1" });

    const result = await createBillingRecordAction(null, formData(validBilling));

    expect(expectOk(result)).toEqual({ id: "bill-1" });
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ action: "BILLING_UPDATED" }));
    expect(revalidatePathMock).toHaveBeenCalledWith("/finance");
  });

  it("forbids marketers from creating billing", async () => {
    const { createBillingRecordAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser());

    const result = await createBillingRecordAction(null, formData(validBilling));
    expectFail(result, ErrorCode.FORBIDDEN);
    expect(createBillingRecordMock).not.toHaveBeenCalled();
  });

  it("maps a duplicate billing to a conflict", async () => {
    const { createBillingRecordAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue({ id: "c1", assignedMarketerId: null });
    createBillingRecordMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" })
    );

    const result = await createBillingRecordAction(null, formData(validBilling));
    expectFail(result, ErrorCode.CONFLICT);
  });
});

describe("recordPaymentAction", () => {
  it("records a payment against an accessible billing", async () => {
    const { recordPaymentAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser({ id: "admin-1" }));
    loadAccessScopesMock.mockResolvedValue([
      { adminId: "admin-1", marketerId: null, clientId: "c1", allMarketers: false, allClients: false }
    ]);
    getBillingAccessInfoMock.mockResolvedValue({ id: "bill-1", clientId: "c1", clientAssignedMarketerId: null });
    recordPaymentMock.mockResolvedValue({ id: "pay-1", billingId: "bill-1", paidAmount: 500000, status: "PARTIALLY_PAID" });

    const result = await recordPaymentAction(
      null,
      formData({ billingRecordId: "bill-1", amount: "500000", method: PaymentMethod.BANK_TRANSFER, receivedAt: "2026-06-15" })
    );

    expect(expectOk(result)).toEqual({ id: "pay-1" });
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PAYMENT_UPDATED", targetId: "bill-1" })
    );
  });

  it("returns NOT_FOUND for a missing billing", async () => {
    const { recordPaymentAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getBillingAccessInfoMock.mockResolvedValue(null);

    const result = await recordPaymentAction(
      null,
      formData({ billingRecordId: "missing", amount: "1000", method: PaymentMethod.CASH, receivedAt: "2026-06-15" })
    );
    expectFail(result, ErrorCode.NOT_FOUND);
  });
});

describe("createExpenseRecordAction", () => {
  it("lets any authenticated user submit a common expense", async () => {
    const { createExpenseRecordAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    createExpenseRecordMock.mockResolvedValue({ id: "exp-1" });

    const result = await createExpenseRecordAction(
      null,
      formData({ category: "비품", amount: "20000", paymentMethod: PaymentMethod.CARD })
    );

    expect(expectOk(result)).toEqual({ id: "exp-1" });
    expect(createExpenseRecordMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 20000 }), "marketer-1");
    expect(getClientAccessInfoMock).not.toHaveBeenCalled();
  });

  it("checks client access when a client is attached", async () => {
    const { createExpenseRecordAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getClientAccessInfoMock.mockResolvedValue({ id: "c9", assignedMarketerId: "marketer-2" });

    const result = await createExpenseRecordAction(
      null,
      formData({ category: "광고", amount: "5000", paymentMethod: PaymentMethod.CARD, clientId: "c9" })
    );

    expectFail(result, ErrorCode.FORBIDDEN);
    expect(createExpenseRecordMock).not.toHaveBeenCalled();
  });
});

describe("reviewExpenseAction", () => {
  it("reviews an expense as admin and audits it", async () => {
    const { reviewExpenseAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getExpenseAccessInfoMock.mockResolvedValue({ id: "exp-1", clientId: null, clientAssignedMarketerId: null });
    reviewExpenseRecordMock.mockResolvedValue({ id: "exp-1", reviewStatus: ExpenseReviewStatus.REVIEWED });

    const result = await reviewExpenseAction(null, formData({ id: "exp-1", reviewStatus: ExpenseReviewStatus.REVIEWED }));

    expect(expectOk(result)).toEqual({ id: "exp-1" });
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ action: "EXPENSE_REVIEWED" }));
  });

  it("forbids marketers from reviewing expenses", async () => {
    const { reviewExpenseAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser());

    const result = await reviewExpenseAction(null, formData({ id: "exp-1", reviewStatus: ExpenseReviewStatus.REVIEWED }));
    expectFail(result, ErrorCode.FORBIDDEN);
    expect(getExpenseAccessInfoMock).not.toHaveBeenCalled();
  });
});
