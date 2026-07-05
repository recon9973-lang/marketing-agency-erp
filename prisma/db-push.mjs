/**
 * 빌드 시 스키마 반영(prisma db push)을 "직접 연결"로 실행한다.
 *
 * Neon의 풀링 엔드포인트(호스트에 `-pooler` 포함)로는 스키마 변경(DDL/advisory lock)이
 * 불안정해 `prisma db push`가 실패한다. 앱 런타임 쿼리는 풀링(DATABASE_URL)을 그대로 쓰되,
 * db push만 `-pooler`를 제거한 직접 연결로 돌린다. 별도 환경변수 추가가 필요 없다.
 */
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[db-push] DATABASE_URL이 설정돼 있지 않습니다.");
  process.exit(1);
}

// Neon: 풀링 호스트는 직접 호스트에 `-pooler`만 추가된 형태다.
const directUrl = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");
if (directUrl !== url) {
  console.log("[db-push] 풀링 URL 감지 → 직접 연결로 db push를 실행합니다.");
} else {
  console.log("[db-push] 직접 연결 URL로 db push를 실행합니다.");
}

const result = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: directUrl }
});

process.exit(result.status ?? 1);
