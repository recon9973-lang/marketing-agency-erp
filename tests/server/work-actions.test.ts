import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, WorkCategory, WorkStatus } from "@/domain/types";
import { ErrorCodes } from "@/server/errors";
import { changeWorkStatus, createWorkItem, updateWorkItem } from "@/server/actions/work";
import { expectFail, expectOk } from "../helpers/action-result";
import { makeAdmin, makeMarketer, makeScope, makeSuperAdmin } from "../helpers/fixtures";

const {
  getCurrentUserMock,
  workFindUniqueMock,
  workCreateMock,
  workUpdateMock,
  clientFindUniqueMock,
  userFindUniqueMock,
  accessScopeFindManyMock,
  auditLogCreateMock,
  revalidatePathMock
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  workFindUniqueMock: vi.fn(),
  workCreateMock: vi.fn(),
  workUpdateMock: vi.fn(),
  clientFindUniqueMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  accessScopeFindManyMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn()
}));

vi.mock("@/server/session", () => ({
  getCurrentUser: getCurrentUserMock
}));

vi.mock("@/server/db", () => ({
  db: {
    workItem: {
      findUnique: workFindUniqueMock,
      create: workCreateMock,
      update: workUpdateMock
    },
    client: { findUnique: clientFindUniqueMock },
    user: { findUnique: userFindUniqueMock },
    accessScope: { findMany: accessScopeFindManyMock },
    auditLog: { create: auditLogCreateMock }
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

const validInput = {
  title: "7월 블로그 배포",
  clientId: "client-1",
  ownerId: "marketer-1",
  category: WorkCategory.BLOG_DISTRIBUTION,
  priority: "2",
  dueDate: "2026-07-15",
  progressNotes: "키워드 확정 후 진행"
};

const storedWork = {
  id: "work-1",
  title: "7월 블로그 배포",
  clientId: "client-1",
  ownerId: "marketer-1",
  category: WorkCategory.BLOG_DISTRIBUTION,
  status: WorkStatus.NOT_STARTED,
  priority: 2,
  dueDate: new Date("2026-07-15T00:00:00.000Z"),
  startedAt: null,
  completedAt: null,
  progressNotes: "키워드 확정 후 진행"
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(makeSuperAdmin());
  workFindUniqueMock.mockResolvedValue(storedWork);
  workCreateMock.mockResolvedValue(storedWork);
  workUpdateMock.mockResolvedValue(storedWork);
  clientFindUniqueMock.mockResolvedValue({ assignedMarketerId: "marketer-1" });
  userFindUniqueMock.mockResolvedValue({ id: "marketer-1", role: Role.MARKETER, isActive: true });
  accessScopeFindManyMock.mockResolvedValue([]);
  auditLogCreateMock.mockResolvedValue({});
});

describe("createWorkItem", () => {
  it("returns field errors for invalid input", async () => {
    const result = await createWorkItem({ title: " ", clientId: "", ownerId: "", category: "INVALID" });

    const error = expectFail(result, ErrorCodes.VALIDATION_ERROR);
    expect(error.fieldErrors?.title).toBeDefined();
    expect(error.fieldErrors?.category).toEqual(["허용되지 않는 업무 카테고리입니다."]);
    expect(workCreateMock).not.toHaveBeenCalled();
  });

  it("rejects owners who are not active marketers", async () => {
    userFindUniqueMock.mockResolvedValue({ id: "admin-1", role: Role.ADMIN, isActive: true });

    const error = expectFail(await createWorkItem(validInput), ErrorCodes.VALIDATION_ERROR);
    expect(error.fieldErrors?.ownerId).toBeDefined();
  });

  it("blocks marketers from creating work for other owners", async () => {
    getCurrentUserMock.mockResolvedValue(makeMarketer({ id: "marketer-2" }));
    clientFindUniqueMock.mockResolvedValue({ assignedMarketerId: "marketer-2" });

    expectFail(await createWorkItem(validInput), ErrorCodes.FORBIDDEN);
    expect(workCreateMock).not.toHaveBeenCalled();
  });

  it("blocks marketers from other marketers' clients", async () => {
    getCurrentUserMock.mockResolvedValue(makeMarketer({ id: "marketer-1" }));
    clientFindUniqueMock.mockResolvedValue({ assignedMarketerId: "marketer-9" });

    expectFail(await createWorkItem(validInput), ErrorCodes.FORBIDDEN);
  });

  it("allows marketers to create their own work for assigned clients", async () => {
    getCurrentUserMock.mockResolvedValue(makeMarketer({ id: "marketer-1" }));
    clientFindUniqueMock.mockResolvedValue({ assignedMarketerId: "marketer-1" });

    expectOk(await createWorkItem(validInput));
    expect(workCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "7월 블로그 배포",
        clientId: "client-1",
        ownerId: "marketer-1",
        priority: 2,
        dueDate: new Date("2026-07-15T00:00:00.000Z"),
        createdById: "marketer-1"
      })
    });
  });

  it("blocks admins outside their scopes and allows admins inside", async () => {
    const admin = makeAdmin();
    getCurrentUserMock.mockResolvedValue(admin);

    accessScopeFindManyMock.mockResolvedValue([]);
    expectFail(await createWorkItem(validInput), ErrorCodes.FORBIDDEN);

    accessScopeFindManyMock.mockResolvedValue([
      makeScope({ clientId: "client-1" }),
      makeScope({ marketerId: "marketer-1" })
    ]);
    expectOk(await createWorkItem(validInput));
  });

  it("writes an audit log and revalidates the list on success", async () => {
    expectOk(await createWorkItem(validInput));

    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "WORK_CREATED",
        targetType: "WorkItem",
        targetId: "work-1"
      })
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/work");
  });
});

describe("updateWorkItem", () => {
  it("returns NOT_FOUND for missing work items", async () => {
    workFindUniqueMock.mockResolvedValue(null);

    expectFail(await updateWorkItem("missing", validInput), ErrorCodes.NOT_FOUND);
  });

  it("records before/after audit states on success", async () => {
    workUpdateMock.mockResolvedValue({ ...storedWork, title: "새 제목" });

    expectOk(await updateWorkItem("work-1", { ...validInput, title: "새 제목" }));

    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "WORK_UPDATED",
        beforeState: expect.objectContaining({ title: "7월 블로그 배포" }),
        afterState: expect.objectContaining({ title: "새 제목" })
      })
    });
  });
});

describe("changeWorkStatus", () => {
  it("starts NOT_STARTED work and stamps startedAt", async () => {
    workUpdateMock.mockResolvedValue({ ...storedWork, status: WorkStatus.IN_PROGRESS });

    const result = await changeWorkStatus("work-1", "start");

    expect(expectOk(result)).toEqual({ id: "work-1", status: WorkStatus.IN_PROGRESS });
    expect(workUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WorkStatus.IN_PROGRESS,
          startedAt: expect.any(Date)
        })
      })
    );
    expect(auditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "WORK_STATUS_CHANGED",
        beforeState: { status: WorkStatus.NOT_STARTED },
        afterState: { status: WorkStatus.IN_PROGRESS }
      })
    });
  });

  it("rejects transitions that are not allowed from the current status", async () => {
    expectFail(await changeWorkStatus("work-1", "approve"), ErrorCodes.VALIDATION_ERROR);
    expect(workUpdateMock).not.toHaveBeenCalled();
  });

  it("blocks marketers from approving review-needed work", async () => {
    getCurrentUserMock.mockResolvedValue(makeMarketer({ id: "marketer-1" }));
    workFindUniqueMock.mockResolvedValue({ ...storedWork, status: WorkStatus.REVIEW_NEEDED });

    expectFail(await changeWorkStatus("work-1", "approve"), ErrorCodes.FORBIDDEN);
  });

  it("lets admins approve review-needed work and stamps completedAt", async () => {
    const admin = makeAdmin();
    getCurrentUserMock.mockResolvedValue(admin);
    accessScopeFindManyMock.mockResolvedValue([makeScope({ clientId: "client-1", marketerId: "marketer-1" })]);
    workFindUniqueMock.mockResolvedValue({ ...storedWork, status: WorkStatus.REVIEW_NEEDED });
    workUpdateMock.mockResolvedValue({ ...storedWork, status: WorkStatus.COMPLETED });

    const result = await changeWorkStatus("work-1", "approve");

    expect(expectOk(result)).toEqual({ id: "work-1", status: WorkStatus.COMPLETED });
    expect(workUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WorkStatus.COMPLETED,
          completedAt: expect.any(Date)
        })
      })
    );
  });

  it("rejects unknown status actions", async () => {
    expectFail(await changeWorkStatus("work-1", "teleport"), ErrorCodes.VALIDATION_ERROR);
  });
});
