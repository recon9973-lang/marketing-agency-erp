import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ErrorCode } from "@/server/errors";
import { adminUser, marketerUser, superAdminUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const loadAccessScopesMock = vi.fn();
const createClientMock = vi.fn();
const updateClientMock = vi.fn();
const getClientAccessInfoMock = vi.fn();
const getClientDetailMock = vi.fn();
const writeAuditLogMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));
vi.mock("@/server/repositories/clients", () => ({
  createClient: createClientMock,
  updateClient: updateClientMock,
  getClientAccessInfo: getClientAccessInfoMock,
  getClientDetail: getClientDetailMock
}));
vi.mock("@/server/audit", async () => {
  const actual = await vi.importActual<typeof import("@/server/audit")>("@/server/audit");
  return { ...actual, writeAuditLog: writeAuditLogMock };
});
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/clients");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

const validClient = { name: "새 거래처", code: "NEW-001", monthlyContractFee: "1000000" };

beforeEach(() => {
  vi.clearAllMocks();
  loadAccessScopesMock.mockResolvedValue([]);
  writeAuditLogMock.mockResolvedValue(true);
});

describe("createClientAction", () => {
  it("creates a client as super admin and writes an audit log", async () => {
    const { createClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    createClientMock.mockResolvedValue({ id: "client-new" });

    const result = await createClientAction(null, formData(validClient));

    expect(expectOk(result)).toEqual({ id: "client-new" });
    expect(createClientMock).toHaveBeenCalledWith(expect.objectContaining({ name: "새 거래처", code: "NEW-001" }));
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CLIENT_CREATED", targetId: "client-new" })
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/clients");
  });

  it("forbids non super admins from creating clients", async () => {
    const { createClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser());

    const result = await createClientAction(null, formData(validClient));

    expectFail(result, ErrorCode.FORBIDDEN);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns validation errors for invalid input", async () => {
    const { createClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());

    const result = await createClientAction(null, formData({ name: "", code: "" }));

    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.name).toBeDefined();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("maps a duplicate client code to a conflict", async () => {
    const { createClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    createClientMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", { code: "P2002", clientVersion: "6" })
    );

    const result = await createClientAction(null, formData(validClient));

    expectFail(result, ErrorCode.CONFLICT);
  });

  it("rejects an unauthenticated caller", async () => {
    const { createClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(null);

    const result = await createClientAction(null, formData(validClient));

    expectFail(result, ErrorCode.UNAUTHENTICATED);
  });
});

describe("updateClientAction", () => {
  it("updates an accessible client and records before/after state", async () => {
    const { updateClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue({ id: "client-1", assignedMarketerId: null });
    getClientDetailMock.mockResolvedValue({ id: "client-1", name: "이전 이름" });
    updateClientMock.mockResolvedValue({ id: "client-1" });

    const result = await updateClientAction(null, formData({ ...validClient, id: "client-1" }));

    expect(expectOk(result)).toEqual({ id: "client-1" });
    expect(updateClientMock).toHaveBeenCalledWith("client-1", expect.objectContaining({ code: "NEW-001" }));
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CLIENT_UPDATED", beforeState: { id: "client-1", name: "이전 이름" } })
    );
  });

  it("returns NOT_FOUND when the client does not exist", async () => {
    const { updateClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue(null);

    const result = await updateClientAction(null, formData({ ...validClient, id: "missing" }));

    expectFail(result, ErrorCode.NOT_FOUND);
    expect(updateClientMock).not.toHaveBeenCalled();
  });

  it("forbids marketers from updating clients", async () => {
    const { updateClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser());

    const result = await updateClientAction(null, formData({ ...validClient, id: "client-1" }));

    expectFail(result, ErrorCode.FORBIDDEN);
    expect(getClientAccessInfoMock).not.toHaveBeenCalled();
  });

  it("forbids an admin without access to the client's scope", async () => {
    const { updateClientAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser({ id: "admin-1" }));
    getClientAccessInfoMock.mockResolvedValue({ id: "client-1", assignedMarketerId: "marketer-9" });
    loadAccessScopesMock.mockResolvedValue([]);

    const result = await updateClientAction(null, formData({ ...validClient, id: "client-1" }));

    expectFail(result, ErrorCode.FORBIDDEN);
    expect(updateClientMock).not.toHaveBeenCalled();
  });
});
