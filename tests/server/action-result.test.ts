import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fail, fieldErrorsFromZod, ok, runAction, toActionFailure } from "@/server/action-result";
import { ErrorCode, conflict, forbidden, validationError } from "@/server/errors";
import { expectFail, expectOk } from "../helpers/action-result";

describe("action result helpers", () => {
  it("represents success with ok()", () => {
    const result = ok({ id: "1" });
    expect(expectOk(result)).toEqual({ id: "1" });
  });

  it("represents failure with fail()", () => {
    const result = fail(ErrorCode.CONFLICT, "이미 처리되었습니다.");
    const error = expectFail(result, ErrorCode.CONFLICT);
    expect(error.message).toBe("이미 처리되었습니다.");
    expect(error.fieldErrors).toBeUndefined();
  });

  it("converts zod issues into field errors", () => {
    const schema = z.object({ name: z.string().min(1, "필수입니다."), amount: z.number().min(0, "0 이상") });
    const parsed = schema.safeParse({ name: "", amount: -1 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = fieldErrorsFromZod(parsed.error);
      expect(fieldErrors.name).toContain("필수입니다.");
      expect(fieldErrors.amount).toContain("0 이상");
    }
  });

  it("maps AppError to a failure preserving code and field errors", () => {
    const result = toActionFailure(validationError("확인해주세요.", { email: ["형식 오류"] }));
    const error = expectFail(result, ErrorCode.VALIDATION_ERROR);
    expect(error.fieldErrors).toEqual({ email: ["형식 오류"] });
  });

  it("maps unknown errors to INTERNAL_ERROR without leaking details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = toActionFailure(new Error("db exploded at host"));
    const error = expectFail(result, ErrorCode.INTERNAL_ERROR);
    expect(error.message).not.toContain("db exploded");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("runAction wraps a throwing action into a standard result", async () => {
    const success = await runAction(async () => ({ ok: 1 }));
    expect(expectOk(success)).toEqual({ ok: 1 });

    const failure = await runAction(async () => {
      throw forbidden("권한 없음");
    });
    expectFail(failure, ErrorCode.FORBIDDEN);

    const zodFailure = await runAction(async () => {
      z.string().parse(42);
    });
    expectFail(zodFailure, ErrorCode.VALIDATION_ERROR);
  });

  it("runAction maps a thrown conflict", async () => {
    const result = await runAction(() => {
      throw conflict();
    });
    expectFail(result, ErrorCode.CONFLICT);
  });
});
