import { describe, expect, it } from "vitest";
import { AppError, ErrorCode, isAppError, toSafeMessage } from "@/server/errors";

describe("AppError", () => {
  it("factories set the right code", () => {
    expect(AppError.forbidden().code).toBe(ErrorCode.FORBIDDEN);
    expect(AppError.notFound().code).toBe(ErrorCode.NOT_FOUND);
    expect(AppError.conflict().code).toBe(ErrorCode.CONFLICT);
    expect(AppError.validation().code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(AppError.internal().code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it("is recognized by isAppError and instanceof", () => {
    const err = AppError.forbidden("nope");
    expect(isAppError(err)).toBe(true);
    expect(err instanceof AppError).toBe(true);
    expect(err.message).toBe("nope");
  });

  it("carries fieldErrors on validation", () => {
    const err = AppError.validation("입력 오류", { name: ["필수"] });
    expect(err.fieldErrors).toEqual({ name: ["필수"] });
  });
});

describe("toSafeMessage", () => {
  it("preserves AppError message", () => {
    expect(toSafeMessage(AppError.forbidden("권한 없음"))).toBe("권한 없음");
  });

  it("masks raw errors (never leaks DB/Prisma details)", () => {
    const raw = new Error("PrismaClientKnownRequestError: column x does not exist");
    expect(toSafeMessage(raw)).not.toContain("Prisma");
  });
});
