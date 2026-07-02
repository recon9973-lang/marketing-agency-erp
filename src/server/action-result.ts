import type { ZodError } from "zod";

export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<T> {
  const error: ActionError = { code, message };

  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    error.fieldErrors = fieldErrors;
  }

  return { ok: false, error };
}

export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
  }

  return fieldErrors;
}
