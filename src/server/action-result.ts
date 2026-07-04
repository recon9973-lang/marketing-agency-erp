// V2 §1 공통 인프라 — 공통 server action/API 응답 규약
//
// 모든 저장/수정/승인 액션이 같은 성공/실패 형식을 사용한다.
// UI는 error.code로 분기하고 error.message/ fieldErrors로 사용자 안내를 렌더한다.

import { ZodError } from "zod";
import { AppError, ErrorCode, isAppError, toSafeMessage } from "./errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<never> {
  return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } };
}

// Zod 검증 오류 → field-level 오류 맵. UI에서 필드별 메시지 표시에 사용.
export function zodToFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function failFromZod(error: ZodError, message = "입력값을 확인해주세요."): ActionResult<never> {
  return fail(ErrorCode.VALIDATION_ERROR, message, zodToFieldErrors(error));
}

// 임의 예외를 표준 실패 응답으로. AppError/ZodError는 의미를 보존하고,
// 그 외(DB/Prisma 등)는 INTERNAL_ERROR + 안전 메시지로 마스킹한다.
export function failFromError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) return failFromZod(error);
  if (isAppError(error)) return fail(error.code, error.message, error.fieldErrors);
  return fail(ErrorCode.INTERNAL_ERROR, toSafeMessage(error));
}

// server action 본문을 감싸 예외를 표준 실패 응답으로 변환한다.
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    return failFromError(error);
  }
}

export function isOk<T>(result: ActionResult<T>): result is { ok: true; data: T } {
  return result.ok;
}
