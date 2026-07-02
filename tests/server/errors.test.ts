import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, ErrorCodes, isAppError, runAction, toActionError } from "@/server/errors";
import { expectFail, expectOk } from "../helpers/action-result";

describe("AppError", () => {
  it("uses a default korean message per code", () => {
    expect(new AppError(ErrorCodes.FORBIDDEN).message).toBe("접근 권한이 없습니다.");
    expect(new AppError(ErrorCodes.NOT_FOUND).message).toBe("대상을 찾을 수 없습니다.");
  });

  it("keeps custom messages and field errors", () => {
    const error = new AppError(ErrorCodes.VALIDATION_ERROR, "금액을 확인해주세요.", {
      fieldErrors: { amount: ["0 이상이어야 합니다."] }
    });

    expect(error.message).toBe("금액을 확인해주세요.");
    expect(error.fieldErrors).toEqual({ amount: ["0 이상이어야 합니다."] });
    expect(isAppError(error)).toBe(true);
  });
});

describe("runAction", () => {
  it("returns ok with the action return value", async () => {
    const result = await runAction(() => ({ id: "work-1" }));

    expect(expectOk(result)).toEqual({ id: "work-1" });
  });

  it("converts AppError into the shared failure shape", async () => {
    const result = await runAction(() => {
      throw new AppError(ErrorCodes.FORBIDDEN);
    });

    const error = expectFail(result, ErrorCodes.FORBIDDEN);
    expect(error.message).toBe("접근 권한이 없습니다.");
  });

  it("converts zod errors into validation failures with field errors", async () => {
    const schema = z.object({ name: z.string().min(1, "이름을 입력해주세요.") });

    const result = await runAction(() => schema.parse({ name: "" }));

    const error = expectFail(result, ErrorCodes.VALIDATION_ERROR);
    expect(error.fieldErrors).toEqual({ name: ["이름을 입력해주세요."] });
  });

  it("hides raw error details behind INTERNAL_ERROR", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runAction(() => {
      throw new Error("connection refused: postgres://user:secret@db:5432");
    });

    const error = expectFail(result, ErrorCodes.INTERNAL_ERROR);
    expect(error.message).not.toContain("postgres");
    expect(error.message).toBe("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("toActionError", () => {
  it("passes through app error codes and messages", () => {
    const result = toActionError(new AppError(ErrorCodes.CONFLICT));

    expectFail(result, ErrorCodes.CONFLICT);
  });
});
