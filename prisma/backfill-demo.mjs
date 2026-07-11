/**
 * 데모 활력 데이터 백필(멱등·비파괴).
 *
 * 목적: 대시보드/업무/정산/의료법 위젯이 전부 0으로 비어 "미완성"처럼 보이지 않도록,
 *   거래처에 걸린 업무·청구·콘텐츠기획 데모 데이터를 채운다.
 *
 * 안전장치:
 *  - 각 엔티티는 "전역 개수 0일 때만" 생성 → 실데이터가 하나라도 있으면 절대 건드리지 않음.
 *  - 모든 데모 레코드 제목/주제에 "[데모]" 마커 → 식별·삭제 용이.
 *  - 실패해도 빌드를 막지 않음(exit 0). DB 미연결 시 스킵.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.warn("[demo] DATABASE_URL 미설정 — 스킵");
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");
const prisma = new PrismaClient({ datasources: { db: { url: direct } }, log: ["error"] });

const D = "[데모]";

function dayOffset(days) {
  const d = new Date();
  d.setUTCHours(3, 0, 0, 0); // 12:00 KST 근처
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function firstOfMonth(monthsAgo) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d;
}
function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 업무 데모 셋 — 상태/카테고리/마감을 섞어 대시보드 지표(전체/완료/지연/검토/오늘/보고서/다가오는마감)를 채운다.
const WORK_TEMPLATES = [
  { title: "브랜드 블로그 발행", category: "BRAND_BLOG", status: "COMPLETED", due: -6 },
  { title: "플레이스 순위 관리", category: "PLACE_RANKING", status: "IN_PROGRESS", due: -2 }, // 지연
  { title: "콘텐츠 의료법 검수 반영", category: "BLOG_SEO", status: "REVIEW_NEEDED", due: 0 }, // 오늘+검토
  { title: "SNS 콘텐츠 배포", category: "SNS_MANAGEMENT", status: "NOT_STARTED", due: 3 }, // 다가오는
  { title: "월간 성과 보고서 작성", category: "MONTHLY_REPORT", status: "IN_PROGRESS", due: 5 } // 보고서
];

async function seedWork(clients, owners) {
  if (!owners.length) return 0;
  if ((await prisma.workItem.count()) !== 0) return 0;
  const rows = [];
  clients.forEach((client, ci) => {
    WORK_TEMPLATES.forEach((t, ti) => {
      const owner = owners[(ci + ti) % owners.length];
      rows.push({
        clientId: client.id,
        ownerId: owner.id,
        title: `${D} ${client.name} ${t.title}`,
        category: t.category,
        status: t.status,
        dueDate: dayOffset(t.due),
        ...(t.status === "COMPLETED" ? { completedAt: dayOffset(t.due) } : {}),
        ...(t.status === "IN_PROGRESS" ? { startedAt: dayOffset(t.due - 1) } : {})
      });
    });
  });
  await prisma.workItem.createMany({ data: rows });
  return rows.length;
}

async function seedBilling(clients) {
  if ((await prisma.billingRecord.count()) !== 0) return 0;
  const rows = [];
  clients.forEach((client, ci) => {
    const amount = 800000 + (ci % 4) * 400000; // 80만~200만
    // 이번 달: 발행·미입금 → 미수금
    rows.push({
      clientId: client.id,
      billingMonth: firstOfMonth(0),
      contractAmount: amount,
      issuedAmount: amount,
      paidAmount: 0,
      status: ci % 3 === 0 ? "OVERDUE" : "ISSUED",
      dueDate: dayOffset(ci % 3 === 0 ? -5 : 7)
    });
    // 지난 달: 완납
    rows.push({
      clientId: client.id,
      billingMonth: firstOfMonth(1),
      contractAmount: amount,
      issuedAmount: amount,
      paidAmount: amount,
      status: "PAID"
    });
  });
  await prisma.billingRecord.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

async function seedContentPlans(clients) {
  if ((await prisma.contentPlan.count()) !== 0) return 0;
  const month = monthKey(firstOfMonth(0));
  const rows = [];
  clients.forEach((client) => {
    // 컨펌 대기(REVIEWED, 미컨펌) → 거래처 컨펌 위젯
    rows.push({
      clientId: client.id,
      month,
      topic: `${D} ${client.name} 이달의 브랜드 콘텐츠`,
      angle: "핵심 진료·강점을 신뢰감 있게 소개",
      status: "REVIEWED",
      faq: ["예약은 어떻게 하나요?", "주차가 되나요?"],
      qa: [{ q: "진료 시간은?", a: "평일 09~18시" }]
    });
    // 의료법 위험 감지 → 의료법 위험 콘텐츠 위젯
    rows.push({
      clientId: client.id,
      month,
      topic: `${D} ${client.name} 시술 전후 비교 콘텐츠`,
      status: "PLANNED",
      complianceRisk: { high: 1, medium: 2, flags: [{ label: "치료효과 보장 표현", code: "GUARANTEE", severity: "high" }] }
    });
  });
  await prisma.contentPlan.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

try {
  const clients = await prisma.client.findMany({ where: { active: true }, select: { id: true, name: true } });
  if (clients.length === 0) {
    console.log("[demo] 활성 거래처 없음 — 스킵");
  } else {
    const owners = await prisma.user.findMany({
      where: { isActive: true, status: "ACTIVE" },
      select: { id: true },
      take: 20
    });
    const w = await seedWork(clients, owners);
    const b = await seedBilling(clients);
    const c = await seedContentPlans(clients);
    console.log(`[demo] 백필 — 업무 ${w} · 청구 ${b} · 콘텐츠기획 ${c} (거래처 ${clients.length})`);
  }
} catch (err) {
  console.warn(`[demo] 실패(무시하고 빌드 계속): ${String(err).slice(0, 200)}`);
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
process.exit(0);
