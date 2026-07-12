/**
 * 스키마 자가치유(additive 전용) — 실제 DB와 schema.prisma의 차이를 계산해
 * "추가" 문장만 적용한다. `prisma db push`가 (파괴적 변경 확인 요구 등으로)
 * 실패해 스킵되더라도, 누락된 테이블/컬럼/인덱스/enum 값이 반드시 보강된다.
 *
 * 안전 원칙:
 *  - 허용: CREATE TABLE/INDEX/TYPE, ALTER TABLE ... ADD COLUMN, ALTER TYPE ... ADD VALUE
 *  - 차단: DROP/ALTER COLUMN/RENAME 등 모든 파괴·변경 문장 (로그만 남기고 건너뜀)
 *  - 문장 단위 실행, 실패 무시(이미 존재 등) — 멱등
 *  - 실패해도 빌드를 막지 않음(exit 0)
 */
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.warn("[sync] DATABASE_URL 미설정 — 스킵");
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");

let diffSql = "";
try {
  diffSql = execFileSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-url", direct, "--to-schema-datamodel", "prisma/schema.prisma", "--script"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 }
  );
} catch (err) {
  console.warn(`[sync] diff 계산 실패(무시): ${String(err).slice(0, 200)}`);
  process.exit(0);
}

// 문장 분리 — diff 스크립트는 표준 단문 DDL(문장 내 세미콜론 없음) 기준.
const statements = diffSql
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

const ADDITIVE = [
  /^CREATE TABLE /i,
  /^CREATE (UNIQUE )?INDEX /i,
  /^CREATE TYPE /i,
  /^ALTER TYPE .+ ADD VALUE /i,
  /^ALTER TABLE .+ ADD COLUMN /i,
  /^ALTER TABLE .+ ADD CONSTRAINT .+ (PRIMARY KEY|UNIQUE)/i
];

const apply = [];
const skipped = [];
for (const stmt of statements) {
  if (ADDITIVE.some((re) => re.test(stmt))) apply.push(stmt);
  else skipped.push(stmt.slice(0, 80));
}

if (apply.length === 0) {
  console.log(`[sync] 추가할 스키마 변경 없음 (건너뛴 비-additive ${skipped.length}건)`);
  process.exit(0);
}

const prisma = new PrismaClient({ datasources: { db: { url: direct } }, log: ["error"] });
let ok = 0;
let failed = 0;
try {
  for (const stmt of apply) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      ok++;
    } catch (err) {
      failed++;
      console.warn(`[sync] 문장 실패(무시): ${String(err).slice(0, 160)}`);
    }
  }
  console.log(`[sync] additive 보강 — 적용 ${ok} · 실패 ${failed} · 비-additive 건너뜀 ${skipped.length}`);
  if (skipped.length > 0) {
    console.log(`[sync] 건너뛴 문장(수동 검토 필요할 수 있음): ${skipped.slice(0, 5).join(" | ")}`);
  }
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
process.exit(0);
