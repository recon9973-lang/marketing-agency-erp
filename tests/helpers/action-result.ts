import { expect } from "vitest";
import type { ActionResult } from "@/server/action-result";

/**
 * `ActionResult`가 성공인지 단언하고 data를 반환한다 (V2 §1 테스트 인프라).
 */
export function expectOk<T>(result: ActionResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`expected ok result but got failure: ${result.error.code}`);
  }
  return result.data;
}

/**
 * `ActionResult`가 실패인지 단언하고 error를 반환한다. code를 함께 검증할 수 있다.
 */
export function expectFail<T>(result: ActionResult<T>, code?: string) {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error("expected failure result but got ok");
  }
  if (code) {
    expect(result.error.code).toBe(code);
  }
  return result.error;
}
