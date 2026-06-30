import { describe, expect, it } from "vitest";
import {
  AppError,
  ErrorCode,
  conflict,
  forbidden,
  isAppError,
  notFound,
  summarizeError,
  toSafeMessage,
  validationError
} from "@/server/errors";

describe("AppError", () => {
  it("uses standardized codes and default messages", () => {
    expect(forbidden().code).toBe(ErrorCode.FORBIDDEN);
    expect(notFound().code).toBe(ErrorCode.NOT_FOUND);
    expect(conflict().code).toBe(ErrorCode.CONFLICT);
    expect(forbidden().message.length).toBeGreaterThan(0);
  });

  it("carries field errors for validation failures", () => {
    const error = validationError("입력값을 확인해주세요.", { name: ["필수입니다."] });
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors).toEqual({ name: ["필수입니다."] });
    expect(isAppError(error)).toBe(true);
  });

  it("does not leak raw error details to users", () => {
    const raw = new Error("Prisma: connection refused at db:5432");
    expect(toSafeMessage(raw)).not.toContain("Prisma");
    expect(toSafeMessage(raw)).toBe(toSafeMessage(new Error("anything")));
  });

  it("exposes safe AppError messages to users", () => {
    expect(toSafeMessage(forbidden("이 거래처에 접근할 수 없습니다."))).toBe("이 거래처에 접근할 수 없습니다.");
  });

  it("summarizes errors with codes for logging", () => {
    expect(summarizeError(new AppError(ErrorCode.NOT_FOUND, "없음"))).toBe("NOT_FOUND: 없음");
    expect(summarizeError(new Error("boom"))).toContain("INTERNAL_ERROR");
    expect(summarizeError("weird")).toContain("INTERNAL_ERROR");
  });
});
