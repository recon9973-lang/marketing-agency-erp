/**
 * 공통 에러 처리 기반 (V2 §1).
 *
 * 운영 중 발생하는 오류를 표준 코드로 분류하고, 사용자에게는 안전한 메시지를,
 * 서버 로그/감사 로그에는 추적 가능한 요약을 남기기 위한 기반이다.
 *
 * 원칙:
 * - server action/repository는 raw DB/Prisma 오류를 그대로 UI로 흘리지 않는다.
 * - 예상 가능한 도메인 오류는 `AppError`로 던지고, 표준 코드를 부여한다.
 * - 예상치 못한 오류는 `INTERNAL_ERROR`로 감싸 일반화된 메시지만 노출한다.
 */

export type FieldErrors = Record<string, string[]>;

export const ErrorCode = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR"
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHENTICATED]: "로그인이 필요합니다.",
  [ErrorCode.FORBIDDEN]: "이 작업을 수행할 권한이 없습니다.",
  [ErrorCode.NOT_FOUND]: "요청한 대상을 찾을 수 없습니다.",
  [ErrorCode.VALIDATION_ERROR]: "입력값을 확인해주세요.",
  [ErrorCode.CONFLICT]: "현재 상태에서는 처리할 수 없는 요청입니다.",
  [ErrorCode.INTERNAL_ERROR]: "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
};

export type AppErrorOptions = {
  /** field-level validation 오류 (VALIDATION_ERROR에서 주로 사용). */
  fieldErrors?: FieldErrors;
  /** 원본 오류 (로깅/추적용, 사용자에게 노출하지 않음). */
  cause?: unknown;
};

/**
 * 표준 코드를 가진 애플리케이션 오류.
 * `message`는 사용자에게 노출해도 안전한 문구만 담는다.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;

  constructor(code: ErrorCode, message?: string, options: AppErrorOptions = {}) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options.fieldErrors;

    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function unauthenticated(message?: string, options?: AppErrorOptions) {
  return new AppError(ErrorCode.UNAUTHENTICATED, message, options);
}

export function forbidden(message?: string, options?: AppErrorOptions) {
  return new AppError(ErrorCode.FORBIDDEN, message, options);
}

export function notFound(message?: string, options?: AppErrorOptions) {
  return new AppError(ErrorCode.NOT_FOUND, message, options);
}

export function validationError(message?: string, fieldErrors?: FieldErrors, options?: AppErrorOptions) {
  return new AppError(ErrorCode.VALIDATION_ERROR, message, { ...options, fieldErrors });
}

export function conflict(message?: string, options?: AppErrorOptions) {
  return new AppError(ErrorCode.CONFLICT, message, options);
}

export function internalError(message?: string, options?: AppErrorOptions) {
  return new AppError(ErrorCode.INTERNAL_ERROR, message, options);
}

/**
 * 사용자에게 노출해도 안전한 메시지를 반환한다.
 * - `AppError`는 정제된 메시지를 가지므로 그대로 사용한다.
 * - 그 외(원본 Error, Prisma 오류 등)는 일반화된 내부 오류 메시지로 대체한다.
 */
export function toSafeMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  return DEFAULT_MESSAGES[ErrorCode.INTERNAL_ERROR];
}

/**
 * 서버 로그/감사 로그에 남길 수 있는 한 줄 요약을 만든다.
 * 원본 메시지를 포함하므로 사용자에게 직접 노출하지 않는다.
 */
export function summarizeError(error: unknown): string {
  if (isAppError(error)) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return `${ErrorCode.INTERNAL_ERROR}: ${error.name}: ${error.message}`;
  }

  return `${ErrorCode.INTERNAL_ERROR}: ${String(error)}`;
}

/**
 * 예상치 못한 오류를 서버 측에 기록한다. 사용자 흐름을 막지 않는다.
 * 운영 환경에서는 구조화된 로깅 시스템으로 교체할 수 있다.
 */
export function logServerError(error: unknown, context?: Record<string, unknown>) {
  const payload = {
    summary: summarizeError(error),
    ...(context ? { context } : {})
  };

  // eslint-disable-next-line no-console
  console.error("[server-error]", payload);
}
