// V2 §1 공통 인프라 — 표준 에러 타입/코드
//
// 목적: 운영 중 오류가 발생했을 때 사용자에게는 안전한 메시지를 보여주고,
// 서버에는 원인을 추적할 정보를 남긴다. raw DB/Prisma 오류를 사용자에게 직접
// 노출하지 않는다.

export const ErrorCode = {
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = fieldErrors;
    // TS 하위 타깃에서 instanceof 정상 동작 보장
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static forbidden(message = "권한이 없습니다.") {
    return new AppError(ErrorCode.FORBIDDEN, message);
  }
  static notFound(message = "대상을 찾을 수 없습니다.") {
    return new AppError(ErrorCode.NOT_FOUND, message);
  }
  static conflict(message = "이미 처리되었거나 충돌이 발생했습니다.") {
    return new AppError(ErrorCode.CONFLICT, message);
  }
  static validation(message = "입력값을 확인해주세요.", fieldErrors?: Record<string, string[]>) {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, fieldErrors);
  }
  static internal(message = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.") {
    return new AppError(ErrorCode.INTERNAL_ERROR, message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// 사용자에게 노출해도 안전한 메시지. AppError는 그대로, 그 외(DB/Prisma 등)는 일반 문구로 마스킹.
export function toSafeMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  return "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

// ── 통합 기능(채팅 등)이 쓰는 표준 에러 팩토리(standalone) ──
export function forbidden(message?: string) {
  return message ? AppError.forbidden(message) : AppError.forbidden();
}
export function notFound(message?: string) {
  return message ? AppError.notFound(message) : AppError.notFound();
}
export function conflict(message?: string) {
  return message ? AppError.conflict(message) : AppError.conflict();
}
export function validationError(message?: string, fieldErrors?: Record<string, string[]>) {
  return AppError.validation(message ?? "입력값을 확인해주세요.", fieldErrors);
}
