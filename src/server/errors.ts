import { ZodError } from "zod";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/server/action-result";

export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR"
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const defaultMessages: Record<ErrorCode, string> = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  FORBIDDEN: "접근 권한이 없습니다.",
  NOT_FOUND: "대상을 찾을 수 없습니다.",
  VALIDATION_ERROR: "입력값을 확인해주세요.",
  CONFLICT: "다른 변경사항과 충돌했습니다. 새로고침 후 다시 시도해주세요.",
  INTERNAL_ERROR: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: { fieldErrors?: Record<string, string[]>; cause?: unknown }
  ) {
    super(message ?? defaultMessages[code], options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toActionError<T = never>(error: unknown): ActionResult<T> {
  if (isAppError(error)) {
    return fail(error.code, error.message, error.fieldErrors);
  }

  if (error instanceof ZodError) {
    return fail(ErrorCodes.VALIDATION_ERROR, defaultMessages.VALIDATION_ERROR, zodFieldErrors(error));
  }

  console.error("[action] unexpected error", error);
  return fail(ErrorCodes.INTERNAL_ERROR, defaultMessages.INTERNAL_ERROR);
}

export async function runAction<T>(action: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    return ok(await action());
  } catch (error) {
    return toActionError(error);
  }
}
