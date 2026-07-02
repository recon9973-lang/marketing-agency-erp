import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fail, ok, zodFieldErrors } from "@/server/action-result";
import { expectFail, expectOk } from "../helpers/action-result";

describe("action result helpers", () => {
  it("wraps data in a success result", () => {
    const result = ok({ id: "client-1" });

    expect(result).toEqual({ ok: true, data: { id: "client-1" } });
    expect(expectOk(result)).toEqual({ id: "client-1" });
  });

  it("wraps code and message in a failure result", () => {
    const result = fail("FORBIDDEN", "접근 권한이 없습니다.");

    expect(result).toEqual({
      ok: false,
      error: { code: "FORBIDDEN", message: "접근 권한이 없습니다." }
    });
  });

  it("keeps field errors only when present", () => {
    const withFields = fail("VALIDATION_ERROR", "입력값을 확인해주세요.", {
      name: ["이름을 입력해주세요."]
    });
    const withoutFields = fail("VALIDATION_ERROR", "입력값을 확인해주세요.", {});

    const error = expectFail(withFields, "VALIDATION_ERROR");
    expect(error.fieldErrors).toEqual({ name: ["이름을 입력해주세요."] });
    expect(expectFail(withoutFields).fieldErrors).toBeUndefined();
  });

  it("converts zod issues into field errors grouped by path", () => {
    const schema = z.object({
      name: z.string().min(1, "이름을 입력해주세요."),
      amount: z.number().int("정수여야 합니다.").min(0, "0 이상이어야 합니다.")
    });

    const parsed = schema.safeParse({ name: "", amount: -1.5 });
    expect(parsed.success).toBe(false);

    if (parsed.success) {
      throw new Error("unreachable");
    }

    const fieldErrors = zodFieldErrors(parsed.error);

    expect(fieldErrors.name).toEqual(["이름을 입력해주세요."]);
    expect(fieldErrors.amount).toContain("정수여야 합니다.");
    expect(fieldErrors.amount).toContain("0 이상이어야 합니다.");
  });

  it("maps root-level zod issues to a _root key", () => {
    const schema = z
      .object({ startDate: z.string(), endDate: z.string() })
      .refine(() => false, { message: "기간이 올바르지 않습니다." });

    const parsed = schema.safeParse({ startDate: "2026-01-01", endDate: "2026-01-02" });

    if (parsed.success) {
      throw new Error("unreachable");
    }

    expect(zodFieldErrors(parsed.error)).toEqual({ _root: ["기간이 올바르지 않습니다."] });
  });
});
