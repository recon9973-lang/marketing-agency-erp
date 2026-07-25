import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();
vi.mock("@/server/db", () => ({ db: { lead: { findFirst: (...a: unknown[]) => findFirst(...a), create: (...a: unknown[]) => create(...a) } } }));

import { findOrCreateLeadForAnalysis } from "./lead-link";
import { Role } from "@/domain/types";

const base = { region: "강원 춘천시", specialty: "피부과", url: null, userId: "u1", userRole: Role.MARKETER, orgId: "org1" };

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
});

describe("findOrCreateLeadForAnalysis", () => {
  it("업체명이 없거나 자리표시자면 리드를 만들지 않는다(null)", async () => {
    for (const brand of ["", "(신규 병원)", "(일반형 · 병원명 자리)"]) {
      expect(await findOrCreateLeadForAnalysis({ ...base, brand })).toBeNull();
    }
    expect(findFirst).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("같은 업체 리드가 이미 있으면 재사용(중복 생성 안 함)", async () => {
    findFirst.mockResolvedValue({ id: "lead-existing" });
    const id = await findOrCreateLeadForAnalysis({ ...base, brand: "미소진의원" });
    expect(id).toBe("lead-existing");
    expect(create).not.toHaveBeenCalled();
  });

  it("없으면 새 리드 1개 생성(담당 AE=실행자)", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "lead-new" });
    const id = await findOrCreateLeadForAnalysis({ ...base, brand: "미소진의원" });
    expect(id).toBe("lead-new");
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.hospitalName).toBe("미소진의원");
    expect(arg.data.assigneeId).toBe("u1");
    expect(arg.data.source).toBe("분석 자동생성");
  });

  it("관리자 실행 시 담당 AE 미배정(null)", async () => {
    findFirst.mockResolvedValue(null);
    create.mockResolvedValue({ id: "lead-new" });
    await findOrCreateLeadForAnalysis({ ...base, brand: "미소진의원", userRole: Role.ADMIN });
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.assigneeId).toBeNull();
  });
});
