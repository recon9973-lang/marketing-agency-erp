import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkCategory, WorkStatus } from "@/domain/types";
import { ErrorCode } from "@/server/errors";
import { adminUser, marketerUser, superAdminUser } from "../helpers/users";
import { expectFail, expectOk } from "../helpers/action-result";

const getCurrentUserMock = vi.fn();
const loadAccessScopesMock = vi.fn();
const getClientAccessInfoMock = vi.fn();
const createWorkItemMock = vi.fn();
const updateWorkItemMock = vi.fn();
const getWorkItemAccessInfoMock = vi.fn();
const getWorkItemDetailMock = vi.fn();
const changeWorkItemStatusMock = vi.fn();
const writeAuditLogMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/server/session", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/server/scope", () => ({ loadAccessScopes: loadAccessScopesMock }));
vi.mock("@/server/repositories/clients", () => ({ getClientAccessInfo: getClientAccessInfoMock }));
vi.mock("@/server/repositories/work", () => ({
  createWorkItem: createWorkItemMock,
  updateWorkItem: updateWorkItemMock,
  getWorkItemAccessInfo: getWorkItemAccessInfoMock,
  getWorkItemDetail: getWorkItemDetailMock,
  changeWorkItemStatus: changeWorkItemStatusMock
}));
vi.mock("@/server/audit", async () => {
  const actual = await vi.importActual<typeof import("@/server/audit")>("@/server/audit");
  return { ...actual, writeAuditLog: writeAuditLogMock };
});
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

async function loadActions() {
  return import("@/server/actions/work");
}

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    fd.set(key, value);
  }
  return fd;
}

const validWork = {
  clientId: "client-1",
  ownerId: "marketer-1",
  title: "6월 블로그",
  category: WorkCategory.BRAND_BLOG,
  priority: "3"
};

beforeEach(() => {
  vi.clearAllMocks();
  loadAccessScopesMock.mockResolvedValue([]);
  writeAuditLogMock.mockResolvedValue(true);
});

describe("createWorkItemAction", () => {
  it("creates a work item for an accessible client as super admin", async () => {
    const { createWorkItemAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue({ id: "client-1", assignedMarketerId: "marketer-1" });
    createWorkItemMock.mockResolvedValue({ id: "work-new" });

    const result = await createWorkItemAction(null, formData(validWork));

    expect(expectOk(result)).toEqual({ id: "work-new" });
    expect(createWorkItemMock).toHaveBeenCalledWith(expect.objectContaining({ title: "6월 블로그" }), superAdminUser().id);
    expect(revalidatePathMock).toHaveBeenCalledWith("/work");
  });

  it("returns NOT_FOUND when the client does not exist", async () => {
    const { createWorkItemAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue(null);

    const result = await createWorkItemAction(null, formData(validWork));
    expectFail(result, ErrorCode.NOT_FOUND);
    expect(createWorkItemMock).not.toHaveBeenCalled();
  });

  it("forbids a marketer from assigning work to another marketer", async () => {
    const { createWorkItemAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(marketerUser({ id: "marketer-1" }));
    getClientAccessInfoMock.mockResolvedValue({ id: "client-1", assignedMarketerId: "marketer-1" });

    const result = await createWorkItemAction(null, formData({ ...validWork, ownerId: "marketer-2" }));
    expectFail(result, ErrorCode.FORBIDDEN);
    expect(createWorkItemMock).not.toHaveBeenCalled();
  });

  it("rejects invalid priority", async () => {
    const { createWorkItemAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getClientAccessInfoMock.mockResolvedValue({ id: "client-1", assignedMarketerId: null });

    const result = await createWorkItemAction(null, formData({ ...validWork, priority: "9" }));
    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors?.priority).toBeDefined();
  });
});

describe("changeWorkStatusAction", () => {
  it("applies a valid transition and stamps timestamps", async () => {
    const { changeWorkStatusAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(adminUser());
    loadAccessScopesMock.mockResolvedValue([
      { adminId: "admin-1", marketerId: "marketer-1", clientId: "client-1", allMarketers: false, allClients: true }
    ]);
    getWorkItemAccessInfoMock.mockResolvedValue({
      id: "work-1",
      clientId: "client-1",
      ownerId: "marketer-1",
      status: WorkStatus.NOT_STARTED,
      startedAt: null,
      completedAt: null,
      clientAssignedMarketerId: "marketer-1"
    });
    changeWorkItemStatusMock.mockResolvedValue({ id: "work-1", status: WorkStatus.IN_PROGRESS });

    const result = await changeWorkStatusAction(null, formData({ id: "work-1", action: "start" }));

    expect(expectOk(result)).toEqual({ id: "work-1" });
    const [, nextStatus, timestamps] = changeWorkItemStatusMock.mock.calls[0];
    expect(nextStatus).toBe(WorkStatus.IN_PROGRESS);
    expect(timestamps.startedAt).toBeInstanceOf(Date);
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WORK_STATUS_CHANGED", afterState: { status: WorkStatus.IN_PROGRESS } })
    );
  });

  it("rejects an invalid transition with a conflict", async () => {
    const { changeWorkStatusAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getWorkItemAccessInfoMock.mockResolvedValue({
      id: "work-1",
      clientId: "client-1",
      ownerId: "marketer-1",
      status: WorkStatus.COMPLETED,
      startedAt: new Date(),
      completedAt: new Date(),
      clientAssignedMarketerId: null
    });

    const result = await changeWorkStatusAction(null, formData({ id: "work-1", action: "start" }));
    expectFail(result, ErrorCode.CONFLICT);
    expect(changeWorkItemStatusMock).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for a missing work item", async () => {
    const { changeWorkStatusAction } = await loadActions();
    getCurrentUserMock.mockResolvedValue(superAdminUser());
    getWorkItemAccessInfoMock.mockResolvedValue(null);

    const result = await changeWorkStatusAction(null, formData({ id: "missing", action: "start" }));
    expectFail(result, ErrorCode.NOT_FOUND);
  });
});
