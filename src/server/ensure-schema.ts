import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";

/**
 * 스키마 드리프트 근본 차단 — Prisma DMMF(스키마 전체)를 훑어 운영 DB에 누락된
 * "모든 테이블의 컬럼"과 "모든 enum 값"을 멱등하게 보강한다(additive 전용).
 *
 * 배경: 빌드 시 `prisma db push`/`sync-additive`가 지연·스킵되면 나중에 추가된 컬럼/enum이
 * 운영 DB에 없어 P2022(컬럼 없음)·invalid enum 오류가 반복됐다. 이 방어층은 서버 부팅 시
 * (instrumentation) 1회 실행되어 그런 누락을 자동 복구한다.
 *
 * 안전 원칙:
 *  - 허용: ALTER TABLE ... ADD COLUMN IF NOT EXISTS, ALTER TYPE ... ADD VALUE IF NOT EXISTS
 *  - 컬럼은 항상 NULLABLE로 추가(데이터가 있는 테이블에서도 안전). 앱 레이어가 필수값을 강제.
 *  - 파괴적 변경(DROP/ALTER COLUMN/타입 변경)은 절대 하지 않는다.
 *  - 문장 단위 best-effort(실패 무시) · 인스턴스당 1회.
 */

const SCALAR_PG: Record<string, string> = {
  String: "TEXT",
  Boolean: "BOOLEAN",
  Int: "INTEGER",
  BigInt: "BIGINT",
  Float: "DOUBLE PRECISION",
  Decimal: "DECIMAL(65,30)",
  DateTime: "TIMESTAMP(3)",
  Json: "JSONB",
  Bytes: "BYTEA"
};

type DmmfField = {
  name: string;
  kind: string;
  type: string;
  isList: boolean;
  isId: boolean;
  hasDefaultValue: boolean;
  default?: unknown;
  dbName?: string | null;
  relationName?: string;
};

function pgType(f: DmmfField): string | null {
  const base = f.kind === "enum" ? `"${f.type}"` : SCALAR_PG[f.type];
  if (!base) return null;
  return f.isList ? `${base}[]` : base;
}

function renderDefault(f: DmmfField): string {
  if (!f.hasDefaultValue || f.isList) return "";
  const d = f.default;
  if (d === null || d === undefined || typeof d === "object") return ""; // 함수형 기본값(now/cuid 등)은 생략
  if (f.kind === "enum") return ` DEFAULT '${String(d).replace(/'/g, "''")}'`;
  switch (f.type) {
    case "Boolean":
      return ` DEFAULT ${d ? "true" : "false"}`;
    case "Int":
    case "BigInt":
    case "Float":
    case "Decimal":
      return ` DEFAULT ${Number(d)}`;
    case "String":
      return ` DEFAULT '${String(d).replace(/'/g, "''")}'`;
    default:
      return "";
  }
}

let ensured: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (ensured) return ensured;
  ensured = (async () => {
    if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_UNPOOLED) return;
    const dm = Prisma.dmmf?.datamodel;
    if (!dm) return;

    // 1) enum 값 보강 — 개별 실행(트랜잭션 밖·autocommit).
    for (const en of dm.enums) {
      const typeName = en.dbName || en.name;
      for (const v of en.values) {
        const val = (v.dbName || v.name).replace(/'/g, "''");
        try {
          await db.$executeRawUnsafe(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${val}'`);
        } catch {
          /* 타입 미존재 등은 무시(테이블/타입 생성은 db push가 담당) */
        }
      }
    }

    // 2) 테이블별 누락 컬럼 보강 — 테이블당 한 문장으로 배치, 실패 시 컬럼 단위 재시도.
    for (const model of dm.models) {
      const table = model.dbName || model.name;
      const clauses: string[] = [];
      for (const f of model.fields as unknown as DmmfField[]) {
        if (f.relationName) continue; // 관계(object) 필드
        if (f.kind !== "scalar" && f.kind !== "enum") continue;
        if (f.isId) continue; // PK는 테이블과 함께 존재
        const type = pgType(f);
        if (!type) continue;
        const col = f.dbName || f.name;
        clauses.push(`ADD COLUMN IF NOT EXISTS "${col}" ${type}${renderDefault(f)}`);
      }
      if (clauses.length === 0) continue;
      try {
        await db.$executeRawUnsafe(`ALTER TABLE "${table}" ${clauses.join(", ")}`);
      } catch {
        // 배치 실패(테이블 미존재 또는 특정 컬럼 문제) → 컬럼 단위로 재시도.
        for (const c of clauses) {
          try {
            await db.$executeRawUnsafe(`ALTER TABLE "${table}" ${c}`);
          } catch {
            /* 무시 */
          }
        }
      }
    }
    console.log("[ensure-schema] 스키마 additive 보강 완료");
  })().catch((e) => {
    console.warn("[ensure-schema] 실패(무시):", String(e).slice(0, 160));
    ensured = null; // 다음 호출에서 재시도 가능.
  });
  return ensured;
}
