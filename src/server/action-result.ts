/**
 * 공통 server action 응답 규약 (V2 §1).
 *
 * 모든 저장/수정/승인 액션이 같은 성공/실패 형식을 사용하게 하여,
 * UI에서 오류 메시지와 성공 메시지를 일관되게 처리할 수 있도록 한다.
 */
import { ZodError } from "zod";
import {
  AppError,
  ErrorCode,
  isAppError,
  logServerError,
  toSafeMessage,
  type FieldErrors
} from "@/server/errors";

export type { FieldErrors } from "@/server/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: FieldErrors;
      };
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(code: string, message: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return {
    ok: false,
    error: fieldErrors ? { code, message, fieldErrors } : { code, message }
  };
}

/**
 * Zod validation 오류를 field-level 오류 맵으로 변환한다.
 * 중첩 경로는 `a.b.c` 형태로 평탄화한다. 경로가 없는 오류는 `_form`에 모은다.
 */
export function fieldErrorsFromZod(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fieldErrors;
}

/**
 * 던져진 오류를 표준 `ActionResult` 실패로 변환한다.
 * - `ZodError` -> VALIDATION_ERROR + fieldErrors
 * - `AppError` -> 코드/안전 메시지/fieldErrors 유지
 * - 그 외 -> 서버 로그 후 INTERNAL_ERROR (raw 메시지 비노출)
 */
export function toActionFailure(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    return fail(ErrorCode.VALIDATION_ERROR, "입력값을 확인해주세요.", fieldErrorsFromZod(error));
  }

  if (isAppError(error)) {
    return fail(error.code, error.message, error.fieldErrors);
  }

  logServerError(error);
  return fail(ErrorCode.INTERNAL_ERROR, toSafeMessage(error));
}

/**
 * server action 본문을 감싸 표준 응답으로 변환하는 wrapper.
 * 액션은 성공 데이터를 반환하거나 `AppError`/`ZodError`를 던지면 된다.
 */
export async function runAction<T>(fn: () => Promise<T> | T): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    return toActionFailure(error);
  }
}

export { AppError, ErrorCode };
