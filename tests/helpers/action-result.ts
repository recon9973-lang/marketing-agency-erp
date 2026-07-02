import { expect } from "vitest";
import type { ActionError, ActionResult } from "@/server/action-result";

export function expectOk<T>(result: ActionResult<T>): T {
  expect(result.ok, `expected ok result, got ${JSON.stringify(result)}`).toBe(true);

  if (!result.ok) {
    throw new Error("unreachable");
  }

  return result.data;
}

export function expectFail<T>(result: ActionResult<T>, code?: string): ActionError {
  expect(result.ok, `expected fail result, got ${JSON.stringify(result)}`).toBe(false);

  if (result.ok) {
    throw new Error("unreachable");
  }

  if (code) {
    expect(result.error.code).toBe(code);
  }

  return result.error;
}
