// 관리자 로그인 비밀번호 해싱 — 외부 의존성 없이 Node 내장 scrypt 사용.
// 저장 형식: "scrypt$<saltHex>$<hashHex>". 검증은 상수시간 비교.
import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// 로그인(auth.ts)과 동일한 정규화 — 맥↔PC 한글 조합/전각/끝공백 불일치 방지.
function normalize(v: string): string {
  return v.normalize("NFKC").trim();
}

const KEYLEN = 64;

/** 비밀번호 → 저장용 해시 문자열. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(normalize(plain), salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

/** 입력 비밀번호가 저장된 해시와 일치하는지(상수시간). 형식 오류/불일치는 false. */
export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const dk = scryptSync(normalize(plain), salt, expected.length);
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}
