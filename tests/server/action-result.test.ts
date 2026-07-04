import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ok,
  fail,
  isOk,
  zodToFieldErrors,
  failFromZod,
  failFromError,
  runAction,
} from "@/server/action-result";
import { AppError, ErrorCode } from "@/server/errors";

describe("action-result", () => {
  it("ok wraps data", () => {
    const r = ok({ id: "1" });
    expect(r.ok).toBe(true);
    expect(isOk(r) && r.data.id).toBe("1");
  });

  it("fail carries code/message and optional fieldErrors", () => {
    const r = fail(ErrorCode.CONFLICT, "이미 처리됨");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.fieldErrors).toBeUndefined();
    }
  });

  it("zodToFieldErrors groups messages by path", () => {
    const schema = z.object({ name: z.string().min(1), age: z.number().min(0) });
    const parsed = schema.safeParse({ name: "", age: -1 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fe = zodToFieldErrors(parsed.error);
      expect(fe.name?.length).toBeGreaterThan(0);
      expect(fe.age?.length).toBeGreaterThan(0);
    }
  });

  it("failFromZod produces a VALIDATION_ERROR result", () => {
    const parsed = z.object({ name: z.string().min(1) }).safeParse({ name: "" });
    if (!parsed.success) {
      const r = failFromZod(parsed.error);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it("failFromError maps AppError, ZodError, and unknown", () => {
    const a = failFromError(AppError.forbidden("no"));
    expect(!a.ok && a.error.code).toBe(ErrorCode.FORBIDDEN);

    const parsed = z.string().min(1).safeParse("");
    if (!parsed.success) {
      const zr = failFromError(parsed.error);
      expect(!zr.ok && zr.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    }

    const unknown = failFromError(new Error("boom raw db error"));
    expect(!unknown.ok && unknown.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(!unknown.ok && unknown.error.message).not.toContain("boom");
  });

  it("runAction converts thrown errors to standard results", async () => {
    const good = await runAction(async () => 42);
    expect(good.ok && good.data).toBe(42);

    const bad = await runAction(async () => {
      throw AppError.notFound("없음");
    });
    expect(!bad.ok && bad.error.code).toBe(ErrorCode.NOT_FOUND);
  });
});
