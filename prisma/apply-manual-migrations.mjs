/**
 * 빌드 시 prisma/manual-migrations/*.sql 을 순서대로 적용한다.
 *
 * 원칙:
 *  - 추가 전용(additive) SQL만 둔다 (CREATE TABLE/INDEX IF NOT EXISTS 등).
 *    기존 데이터/스키마를 삭제·변경하지 않으므로 안전·멱등하다.
 *  - "비파괴(non-fatal)": DB 미연결/실패해도 빌드를 절대 막지 않는다(항상 exit 0).
 *    → `prisma db push` 처럼 배포 전체를 깨뜨리지 않는다.
 *  - DDL 안정성을 위해 풀링(-pooler) 대신 직접 연결을 사용한다.
 */
import { PrismaClient } from "@prisma/client";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.warn("[migrate] DATABASE_URL 미설정 — 스킵합니다.");
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");

const dir = path.join(process.cwd(), "prisma", "manual-migrations");
let files = [];
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
} catch {
  console.warn("[migrate] manual-migrations 폴더 없음 — 스킵합니다.");
  process.exit(0);
}
if (files.length === 0) process.exit(0);

/** SQL 파일을 개별 문장으로 분리(주석/BEGIN/COMMIT 제거). 문장 내 세미콜론은 없다는 전제(추가 DDL). */
function statements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(begin|commit)$/i.test(s));
}

const prisma = new PrismaClient({ datasources: { db: { url: direct } }, log: ["error"] });

let applied = 0;
try {
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    const stmts = statements(sql);
    console.log(`[migrate] ${file}: ${stmts.length}개 문장 적용`);
    for (const stmt of stmts) {
      try {
        await prisma.$executeRawUnsafe(stmt);
        applied += 1;
      } catch (err) {
        console.warn(`[migrate] 문장 실패(무시): ${String(err).slice(0, 160)}`);
      }
    }
  }
  console.log(`[migrate] 완료 — ${applied}개 문장 적용됨.`);
} catch (err) {
  console.warn(`[migrate] 전체 실패(무시하고 빌드 계속): ${String(err).slice(0, 200)}`);
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
process.exit(0); // 항상 성공: 마이그레이션이 빌드를 막지 않는다.
