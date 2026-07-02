import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@/domain/types";
import { ErrorCodes } from "@/server/errors";
import { createClient, setClientActive, updateClient } from "@/server/actions/clients";
import { expectFail, expectOk } from "../helpers/action-result";
import { makeAdmin, makeMarketer, makeSuperAdmin } from "../helpers/fixtures";

const {
  getCurrentUserMock,
  clientFindUniqueMock,
  clientCreateMock,
  clientUpdateMock,
  userFindUniqueMock,
  auditLogCreateMock,
  revalidatePathMock
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  clientCreateMock: vi.fn(),
  clientUpdateMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn()
}));

vi.mock("@/server/session", () => ({
  getCurrentUser: getCurrentUserMock
}));

vi.mock("@/server/db", () => ({
  db: {
    client: {
      findUnique: clientFindUniqueMock,
      create: clientCreateMock,
      update: clientUpdateMock
    },
    user: { findUnique: userFindUniqueMock },
    auditLog: { create: auditLogCreateMock }
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

const validInput = {
  name: "A 병원",
  code: "A-HOSPITAL",
  contactEmail: "owner@a-hospital.test",
  contractStartDate: "2026-07-01",
  contractEndDate: "2026-12-31",
  monthlyContractFee: "1500000",
  assignedMarketerId: "marketer-1",
  active: "on"
};

const storedClient = {
  id: "client-1",
  name: "A 병원",
  code: "A-HOSPITAL",
  active: true,
  assignedMarketerId: "marketer-1",
  monthlyContractFee: 1500000,
  contractStartDate: new Date("2026-07-01T00:00:00.000Z"),
  contractEndDate: new Date("2026-12-31T00:00:00.000Z")
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(makeSuperAdmin());
  clientFindUniqueMock.mockResolvedValue(null);
  clientCreateMock.mockResolvedValue(storedClient);
  clientUpdateMock.mockResolvedValue(storedClient);
  userFindUniqueMock.mockResolvedValue({ id: "marketer-1", role: Role.MARKETER, isActive: true });
  auditLogCreateMock.mockResolvedValue({});
});

describe("createClient", () => {
  it("rejects unauthenticated callers", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    expectFail(await createClient(validInput), ErrorCodes.UNAUTHORIZED);
    expect(clientCreateMock).not.toHaveBeenCalled();
  });

  it("rejects admins and marketers", async () => {
    getCurrentUserMock.mockResolvedValue(makeAdmin());
    expectFail(await createClient(validInput), ErrorCodes.FORBIDDEN);

    getCurrentUserMock.mockResolvedValue(makeMarketer());
    expectFail(await createClient(validInput), ErrorCodes.FORBIDDEN);

    expect(clientCreateMock).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    const result = await createClient({
      name: " ",
      code: "invalid code!!",
      contactEmail: "not-an-email",
      contractStartDate: "2026-12-31",
      contractEndDate: "2026-07-01",
      active: "on"
    });

    const error = expectFail(result, ErrorCodes.VALIDATION_ERROR);
    expect(error.fieldErrors?.name).toBeDefined();
    expect(error.fieldErrors?.code).toBeDefined();
    expect(error.fieldErrors?.contactEmail).toBeDefined();
    expect(error.fieldErrors?.contractEndDate).toEqual(["계약 종료일은 시작일보다 빠를 수 없습니다."]);
    expect(clientCreateMock).not.toHaveBeenCalled();
  });

  it("rejects duplicate client codes with CONFLICT", async () => {
    clientFindUniqueMock.mockResolvedValue({ id: "other-client" });

    const error = expectFail(await createClient(validInput), ErrorCodes.CONFLICT);
    expect(error.fieldErrors?.code).toEqual(["이미 사용 중인 거래처 코드입니다."]);
    expect(clientCreateMock).not.toHaveBeenCalled();
  });

  it("rejects assignment to non-marketer or inactive users", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "admin-9", role: Role.ADMIN, isActive: true });

    const error = expectFail(await createClient(validInput), ErrorCodes.VALIDATION_ERROR);
    expect(error.fieldErrors?.assignedMarketerId).toBeDefined();
    expect(clientCreateMock).not.toHaveBeenCalled();
  });

  it("creates the client, writes an audit log, and revalidates the list", async () => {
    const result = await createClient(validInput);

    expect(expectOk(result)).toEqual({ id: "client-1" });
    expect(clientCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "A 병원",
        code: "A-HOSPITAL",
        contactEmail: "owner@a-hospital.test",
        contractStartDate: new Date("2026-07-01T00:00:00.000Z"),
        contractEndDate: new Date("2026-12-31T00:00:00.000Z"),
        monthlyContractFee: 1500000,
        assignedMarketerId: "marketer-1",
        active: true
      })
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "super-admin-1",
        action: "CLIENT_CREATED",
        targetType: "Client",
        targetId: "client-1"
      })
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/clients");
  });

  it("still succeeds when audit logging fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    auditLogCreateMock.mockRejectedValue(new Error("audit table down"));

    expectOk(await createClient(validInput));
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("updateClient", () => {
  it("returns NOT_FOUND for missing clients", async () => {
    clientFindUniqueMock.mockResolvedValue(null);

    expectFail(await updateClient("missing", validInput), ErrorCodes.NOT_FOUND);
    expect(clientUpdateMock).not.toHaveBeenCalled();
  });

  it("updates the client and records before/after audit states", async () => {
    clientFindUniqueMock
      .mockResolvedValueOnce({ ...storedClient, name: "이전 이름" })
      .mockResolvedValueOnce({ id: "client-1" });

    const result = await updateClient("client-1", validInput);

    expect(expectOk(result)).toEqual({ id: "client-1" });
    expect(clientUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "client-1" } })
    );
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CLIENT_UPDATED",
        targetId: "client-1",
        beforeState: expect.objectContaining({ name: "이전 이름" }),
        afterState: expect.objectContaining({ name: "A 병원" })
      })
    });
  });

  it("allows keeping the client's own code", async () => {
    clientFindUniqueMock
      .mockResolvedValueOnce(storedClient)
      .mockResolvedValueOnce({ id: "client-1" });

    expectOk(await updateClient("client-1", validInput));
  });
});

describe("setClientActive", () => {
  it("requires super admin", async () => {
    getCurrentUserMock.mockResolvedValue(makeAdmin());

    expectFail(await setClientActive("client-1", false), ErrorCodes.FORBIDDEN);
  });

  it("toggles the active flag with an audit trail", async () => {
    clientFindUniqueMock.mockResolvedValue(storedClient);
    clientUpdateMock.mockResolvedValue({ ...storedClient, active: false });

    const result = await setClientActive("client-1", false);

    expect(expectOk(result)).toEqual({ id: "client-1" });
    expect(clientUpdateMock).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: { active: false }
    });
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        beforeState: expect.objectContaining({ active: true }),
        afterState: expect.objectContaining({ active: false })
      })
    });
  });
});
