/**
 * 회사 공식 서식(문서 템플릿) 백필 — 없는 것만 추가(멱등·비파괴).
 *
 * seed-if-empty는 문서 템플릿 테이블이 '비었을 때만' 시드하므로, 이미 운영 중인 DB에
 * 신규 서식을 넣는 유일한 경로다. 이름(name) 기준으로 이미 있으면 건드리지 않아
 * 관리자가 수정한 기존 템플릿을 덮어쓰지 않는다.
 *
 * 실패해도 빌드를 막지 않음(exit 0). DB 미연결 시 스킵.
 */
import { PrismaClient } from "@prisma/client";
import { TEMPLATES } from "./doc-templates-data.mjs";

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.warn("[doc-tpl] DATABASE_URL 미설정 — 스킵");
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");
const prisma = new PrismaClient({ datasources: { db: { url: direct } }, log: ["error"] });

async function run() {
  let created = 0;
  for (const t of TEMPLATES) {
    const exists = await prisma.documentTemplate.findFirst({ where: { name: t.name }, select: { id: true } });
    if (exists) continue;
    await prisma.documentTemplate.create({
      data: { name: t.name, category: t.category, title: t.title, body: t.body, minRole: t.minRole, sortOrder: t.sortOrder }
    });
    created++;
    console.log(`[doc-tpl] 추가: ${t.name}`);
  }
  console.log(created === 0 ? "[doc-tpl] 추가할 서식 없음(모두 존재)" : `[doc-tpl] 서식 ${created}개 추가`);
}

run()
  .catch((e) => console.warn("[doc-tpl] 실패(무시):", e.message))
  .finally(() => prisma.$disconnect());
