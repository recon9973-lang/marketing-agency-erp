// 목표 경로: scripts/migrate-nas-to-erp.ts
//
// NAS 팀 앱(SQLite) → ERP(Prisma/Postgres) 1회성 데이터 이관 — 통합 설계서 v2 §5.
// 신규 모델 없이 ERP 기존 모델로 이전한다:
//   clients            → Client            (assignedMarketerId = 스태프 매핑)
//   accounts(+hint)    → ClientAccount     (credentialHint / 필요 시 passwordEnc 암호화)
//   checklist_progress → WorkItem          (온보딩 태스크, done→COMPLETED)
//   memos              → Comment           (targetType=CLIENT)
//   staff              → User              (선(先)매핑: staffIdMap, 신규 생성 안 함)
//
// 안전장치: 멱등(upsert) · `nas-` 접두 id로 원본 추적 · --dry-run 기본 · 스태프 미매핑 시 fallback.
//
// ⚠️ NAS 실제 테이블/컬럼명은 팀 앱마다 다르다. 아래 NAS_SCHEMA를 실물 DB에 맞춰 확정한 뒤 실행.
//   확인법:  sqlite3 team.db ".schema"   또는   ".tables"
//
// 실행:  tsx scripts/migrate-nas-to-erp.ts --db ./team.db --staff-map ./staff-map.json [--commit]
//   --commit 없으면 dry-run(요약만 출력, DB 미변경).

import { PrismaClient, WorkCategory, WorkStatus } from "@prisma/client";
import { encryptSecret } from "@/server/crypto";

// ─────────────────────────────────────────────────────────────────────────
// NAS 스키마 매핑 — ⚠️ TODO(팀): 실제 NAS SQLite 테이블/컬럼명으로 확정할 것.
// 아래는 설계서 §5 기준 추정치. `.schema`로 확인 후 좌변(테이블)·우변(컬럼) 이름을 맞춘다.
// ─────────────────────────────────────────────────────────────────────────
export const NAS_SCHEMA = {
  clients: {
    table: "clients",
    id: "id",
    name: "name",
    code: "code", // 없으면 id를 code로 사용
    staffId: "staff_id", // 담당 스태프(→ assignedMarketerId)
    region: "region",
    phone: "phone",
    active: "active"
  },
  accounts: {
    table: "accounts",
    id: "id",
    clientId: "client_id",
    label: "label", // 채널/계정 이름
    username: "username",
    passwordHint: "password_hint", // 평문 비번은 이관하지 않음 — 힌트만
    url: "url"
  },
  checklist: {
    table: "checklist_progress",
    id: "id",
    clientId: "client_id",
    title: "item", // 46항목 각 라벨
    done: "done", // 0/1
    staffId: "staff_id"
  },
  memos: {
    table: "memos",
    id: "id",
    clientId: "client_id",
    body: "body",
    staffId: "staff_id",
    createdAt: "created_at"
  }
} as const;

// ─────────────────────────────────────────────────────────────────────────
// 순수 매핑 계층 (DB 무관 · 오프라인 단위 테스트 대상)
// ─────────────────────────────────────────────────────────────────────────

export type StaffIdMap = Record<string, string>; // NAS staffId → ERP User.id

export type MigrateOptions = {
  staffIdMap: StaffIdMap;
  fallbackUserId: string; // 미매핑 스태프의 담당/작성자 대체(필수 — FK 보장)
  encryptCredentials?: boolean; // true면 passwordHint를 passwordEnc로 암호화(crypto 키 필요)
};

/** `nas-<종류>-<원본id>` 결정적 id — 재실행 시 같은 레코드로 upsert(멱등). */
export function nasId(kind: string, rawId: string | number): string {
  return `nas-${kind}-${String(rawId)}`;
}

/** NAS staffId → ERP User.id (미매핑이면 fallback). */
export function resolveUser(staffId: string | number | null | undefined, opts: MigrateOptions): string {
  const key = staffId == null ? "" : String(staffId);
  return opts.staffIdMap[key] ?? opts.fallbackUserId;
}

export type NasClient = { id: string | number; name: string; code?: string | null; staffId?: string | number | null; region?: string | null; phone?: string | null; active?: number | boolean | null };

export function mapClient(row: NasClient, opts: MigrateOptions) {
  const id = nasId("client", row.id);
  const code = row.code ? String(row.code) : id; // code는 unique — 없으면 결정적 id 사용
  const assignedMarketerId = row.staffId != null ? resolveUser(row.staffId, opts) : null;
  const active = row.active == null ? true : Boolean(Number(row.active));
  return {
    where: { id },
    create: { id, name: row.name, code, region: row.region ?? null, contactPhone: row.phone ?? null, active, assignedMarketerId },
    // 재실행 시 code는 건드리지 않음(수동 변경 보존), 나머지만 갱신
    update: { name: row.name, region: row.region ?? null, contactPhone: row.phone ?? null, active, assignedMarketerId }
  };
}

export type NasAccount = { id: string | number; clientId: string | number; label?: string | null; username?: string | null; passwordHint?: string | null; url?: string | null };

export function mapAccount(row: NasAccount, opts: MigrateOptions) {
  const id = nasId("acct", row.id);
  const clientId = nasId("client", row.clientId);
  const label = row.label ? String(row.label) : "(이관 계정)";
  // 비밀번호 평문은 이관하지 않는다. 힌트는 credentialHint로, 옵션 시 passwordEnc로 암호화.
  const passwordEnc = opts.encryptCredentials && row.passwordHint ? encryptSecret(String(row.passwordHint)) : null;
  const usernameEnc = opts.encryptCredentials && row.username ? encryptSecret(String(row.username)) : null;
  const base = {
    clientId,
    label,
    credentialHint: row.passwordHint ? String(row.passwordHint) : null,
    externalUrl: row.url ?? null,
    usernameEnc,
    passwordEnc
  };
  return { where: { id }, create: { id, ...base }, update: base };
}

export type NasChecklistItem = { id: string | number; clientId: string | number; title?: string | null; done?: number | boolean | null; staffId?: string | number | null };

export function mapChecklistItem(row: NasChecklistItem, opts: MigrateOptions) {
  const id = nasId("chk", row.id);
  const clientId = nasId("client", row.clientId);
  const done = Boolean(Number(row.done ?? 0));
  const ownerId = resolveUser(row.staffId, opts);
  const base = {
    clientId,
    ownerId,
    title: row.title ? String(row.title) : "(이관 체크 항목)",
    category: WorkCategory.ACCOUNT_MANAGEMENT,
    status: done ? WorkStatus.COMPLETED : WorkStatus.NOT_STARTED,
    completedAt: done ? new Date() : null,
    progressNotes: "NAS 팀 앱 체크리스트 이관"
  };
  return { where: { id }, create: { id, ...base }, update: base };
}

export type NasMemo = { id: string | number; clientId: string | number; body?: string | null; staffId?: string | number | null; createdAt?: string | number | Date | null };

export function mapMemo(row: NasMemo, opts: MigrateOptions) {
  const id = nasId("memo", row.id);
  const authorId = resolveUser(row.staffId, opts);
  const base = {
    authorId,
    body: row.body ? String(row.body) : "",
    targetType: "CLIENT",
    targetId: nasId("client", row.clientId)
  };
  return { where: { id }, create: { id, ...base }, update: base };
}

export type MigrateCounts = { clients: number; accounts: number; checklist: number; memos: number };

// ─────────────────────────────────────────────────────────────────────────
// I/O 계층 — SQLite 읽기(better-sqlite3, 동적 import) + Prisma 쓰기(upsert)
// ─────────────────────────────────────────────────────────────────────────

type NasRows = { clients: NasClient[]; accounts: NasAccount[]; checklist: NasChecklistItem[]; memos: NasMemo[] };

/** NAS SQLite에서 4개 테이블을 읽어 매핑용 표준 형태로 정규화. better-sqlite3는 선택 의존성(동적 로드). */
export async function readNasDb(dbPath: string): Promise<NasRows> {
  let Database: unknown;
  try {
    // 선택적 런타임 의존성 — specifier를 비리터럴로 두어 tsc 정적 검사(모듈 없음) 회피.
    const spec: string = "better-sqlite3";
    ({ default: Database } = await import(spec));
  } catch {
    throw new Error("better-sqlite3가 설치돼 있지 않습니다. `pnpm add -D better-sqlite3` 후 재실행하세요.");
  }
  const S = NAS_SCHEMA;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new (Database as any)(dbPath, { readonly: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (sql: string): any[] => db.prepare(sql).all();

  const clients: NasClient[] = all(`SELECT ${S.clients.id} AS id, ${S.clients.name} AS name, ${S.clients.code} AS code, ${S.clients.staffId} AS staffId, ${S.clients.region} AS region, ${S.clients.phone} AS phone, ${S.clients.active} AS active FROM ${S.clients.table}`);
  const accounts: NasAccount[] = all(`SELECT ${S.accounts.id} AS id, ${S.accounts.clientId} AS clientId, ${S.accounts.label} AS label, ${S.accounts.username} AS username, ${S.accounts.passwordHint} AS passwordHint, ${S.accounts.url} AS url FROM ${S.accounts.table}`);
  const checklist: NasChecklistItem[] = all(`SELECT ${S.checklist.id} AS id, ${S.checklist.clientId} AS clientId, ${S.checklist.title} AS title, ${S.checklist.done} AS done, ${S.checklist.staffId} AS staffId FROM ${S.checklist.table}`);
  const memos: NasMemo[] = all(`SELECT ${S.memos.id} AS id, ${S.memos.clientId} AS clientId, ${S.memos.body} AS body, ${S.memos.staffId} AS staffId, ${S.memos.createdAt} AS createdAt FROM ${S.memos.table}`);
  db.close();
  return { clients, accounts, checklist, memos };
}

/** 표준화된 NAS 행을 ERP에 upsert. dryRun=true면 건수만 집계(쓰기 없음). */
export async function migrateNas(rows: NasRows, opts: MigrateOptions, prisma: PrismaClient, dryRun: boolean): Promise<MigrateCounts> {
  const counts: MigrateCounts = { clients: 0, accounts: 0, checklist: 0, memos: 0 };

  for (const r of rows.clients) {
    const m = mapClient(r, opts);
    if (!dryRun) await prisma.client.upsert(m);
    counts.clients++;
  }
  for (const r of rows.accounts) {
    const m = mapAccount(r, opts);
    if (!dryRun) await prisma.clientAccount.upsert(m);
    counts.accounts++;
  }
  for (const r of rows.checklist) {
    const m = mapChecklistItem(r, opts);
    if (!dryRun) await prisma.workItem.upsert(m);
    counts.checklist++;
  }
  for (const r of rows.memos) {
    const m = mapMemo(r, opts);
    if (!dryRun) await prisma.comment.upsert(m);
    counts.memos++;
  }
  return counts;
}

// ─────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { db?: string; staffMap?: string; commit: boolean } {
  const out: { db?: string; staffMap?: string; commit: boolean } = { commit: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--db") out.db = argv[++i];
    else if (argv[i] === "--staff-map") out.staffMap = argv[++i];
    else if (argv[i] === "--commit") out.commit = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.db || !args.staffMap) {
    console.error("사용법: tsx scripts/migrate-nas-to-erp.ts --db <team.db> --staff-map <staff-map.json> [--commit]");
    console.error('  staff-map.json 예시: { "staffIdMap": {"1":"<erpUserId>"}, "fallbackUserId": "<erpUserId>", "encryptCredentials": false }');
    process.exitCode = 1;
    return;
  }

  const fs = await import("node:fs");
  const cfg = JSON.parse(fs.readFileSync(args.staffMap, "utf8")) as MigrateOptions;
  if (!cfg.fallbackUserId) throw new Error("staff-map.json에 fallbackUserId(FK 대체용 ERP User.id)가 필요합니다.");

  const prisma = new PrismaClient();
  try {
    // fallback/매핑 User가 실재하는지 검증(FK 실패 예방)
    const referenced = new Set([cfg.fallbackUserId, ...Object.values(cfg.staffIdMap ?? {})]);
    const found = await prisma.user.findMany({ where: { id: { in: [...referenced] } }, select: { id: true } });
    const missing = [...referenced].filter((id) => !found.some((u) => u.id === id));
    if (missing.length) throw new Error(`매핑된 ERP User가 없습니다: ${missing.join(", ")} — staff-map을 확인하세요.`);

    const rows = await readNasDb(args.db);
    const dryRun = !args.commit;
    const counts = await migrateNas(rows, cfg, prisma, dryRun);
    console.log(`${dryRun ? "[DRY-RUN] " : ""}이관 집계:`, counts);
    if (dryRun) console.log("실제 반영하려면 --commit 을 붙여 다시 실행하세요.");
  } finally {
    await prisma.$disconnect();
  }
}

// 직접 실행 시에만 main() 구동(테스트에서 import 시엔 실행 안 함).
if (process.argv[1] && process.argv[1].endsWith("migrate-nas-to-erp.ts")) {
  main().catch((e) => {
    console.error("NAS 이관 실패:", e);
    process.exitCode = 1;
  });
}
