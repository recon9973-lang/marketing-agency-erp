/**
 * DB가 비어 있을 때만 기초 마스터 데이터를 채운다(멱등).
 *  - 업종(IndustryCategory) 대분류/하위(진료과)
 *  - 업무 카테고리(WorkCategoryMaster)
 *  - 채널(ChannelType)
 *  - 회사 정책(CompanySetting) 싱글턴
 * 이미 데이터가 있으면 아무것도 하지 않는다. 실패해도 빌드를 막지 않는다(exit 0).
 * (관리자 계정은 로그인 시 authorizeAdmin 이 upsert 하므로 여기서 만들지 않는다.)
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.warn("[seed] DATABASE_URL 미설정 — 스킵");
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");

const INDUSTRIES = [
  { name: "의료", color: "#e11d48", locked: true, children: ["피부과", "성형외과", "정형외과", "치과", "한의원", "안과", "비뇨의학과", "산부인과", "이비인후과", "내과", "정신건강의학과", "재활의학과", "가정의학과", "통증의학과"] },
  { name: "뷰티", color: "#db2777" },
  { name: "요식", color: "#f59e0b" },
  { name: "법률", color: "#334155" },
  { name: "교육", color: "#2563eb" },
  { name: "부동산", color: "#0d9488" },
  { name: "쇼핑몰·커머스", color: "#7c3aed" }
];

const WORK_CATEGORIES = [
  { name: "브랜드블로그 작성", group: "블로그", color: "#22c55e" },
  { name: "블로그 배포", group: "블로그", color: "#16a34a" },
  { name: "블로그 상위노출", group: "블로그", color: "#15803d" },
  { name: "파워링크", group: "검색광고", color: "#3b82f6" },
  { name: "플레이스 순위관리", group: "지도", color: "#06b6d4" },
  { name: "SNS 관리/배포", group: "SNS", color: "#ec4899" },
  { name: "SEO(웹사이트)", group: "웹", color: "#8b5cf6" },
  { name: "GEO(생성형엔진)", group: "웹", color: "#a855f7" },
  { name: "홈페이지 관리", group: "웹", color: "#6366f1" },
  { name: "계정관리", group: "운영", color: "#64748b" },
  { name: "영수증 리뷰", group: "운영", color: "#f97316" },
  { name: "월간 보고서 작성", group: "운영", color: "#0ea5e9" },
  { name: "방문자수/성과 집계", group: "운영", color: "#14b8a6" }
];

const CHANNELS = ["네이버 블로그", "인스타그램", "페이스북", "유튜브", "스레드", "네이버 플레이스", "홈페이지", "네이버 검색광고(파워링크)", "네이버 애널리틱스/GA", "카카오채널"];
const LOCKED_WORK = new Set(["브랜드블로그 작성", "플레이스 순위관리", "월간 보고서 작성"]);

// 대행 상품 마스터(계약↔상품 브릿지의 기준).
// 실제 광고 대행 계약서의 "광고 품목 및 대행 범위"를 반영(온라인 + 오프라인).
const PRODUCTS = [
  // 블로그
  { name: "브랜드 블로그", category: "블로그" },
  { name: "블로그 배포", category: "블로그" },
  { name: "블로그 상위노출", category: "블로그" },
  { name: "블로그 인플루언서", category: "블로그" },
  // SNS
  { name: "SNS 브랜드", category: "SNS" },
  { name: "SNS 배포", category: "SNS" },
  { name: "SNS 타겟광고", category: "SNS" },
  { name: "SNS 인플루언서", category: "SNS" },
  // 플레이스
  { name: "플레이스 SEO", category: "플레이스" },
  { name: "플레이스 방문자리뷰", category: "플레이스" },
  { name: "플레이스 블로그리뷰", category: "플레이스" },
  { name: "영수증 리뷰", category: "플레이스" },
  // 검색광고
  { name: "파워링크", category: "검색광고" },
  { name: "검색광고 플레이스", category: "검색광고" },
  // 기타 온라인
  { name: "지식iN", category: "기타광고" },
  { name: "뉴스", category: "기타광고" },
  { name: "카페", category: "기타광고" },
  { name: "홈페이지 제작", category: "웹" },
  { name: "SEO", category: "웹" },
  { name: "GEO", category: "웹" },
  { name: "AEO", category: "웹" },
  // 오프라인
  { name: "전광판/횡단보도", category: "오프라인" },
  { name: "버스/택시", category: "오프라인" },
  { name: "지하철/지상철", category: "오프라인" },
  { name: "마트", category: "오프라인" },
  { name: "전단지/현수막/X배너", category: "오프라인" },
  { name: "사진촬영", category: "오프라인" }
];

const prisma = new PrismaClient({ datasources: { db: { url: direct } }, log: ["error"] });

async function seed() {
  // 업종
  if ((await prisma.industryCategory.count()) === 0) {
    for (let i = 0; i < INDUSTRIES.length; i++) {
      const cat = INDUSTRIES[i];
      const parent = await prisma.industryCategory.create({
        data: { name: cat.name, colorTag: cat.color, sortOrder: i, isLocked: Boolean(cat.locked) }
      });
      if (cat.children) {
        for (let j = 0; j < cat.children.length; j++) {
          await prisma.industryCategory.create({ data: { name: cat.children[j], parentId: parent.id, colorTag: cat.color, sortOrder: j } });
        }
      }
    }
    console.log(`[seed] 업종 ${INDUSTRIES.length}개(+하위) 생성`);
  }
  // 업무 카테고리
  if ((await prisma.workCategoryMaster.count()) === 0) {
    for (let i = 0; i < WORK_CATEGORIES.length; i++) {
      const w = WORK_CATEGORIES[i];
      await prisma.workCategoryMaster.create({ data: { name: w.name, group: w.group, colorTag: w.color, sortOrder: i, isLocked: LOCKED_WORK.has(w.name) } });
    }
    console.log(`[seed] 업무 카테고리 ${WORK_CATEGORIES.length}개 생성`);
  }
  // 채널
  if ((await prisma.channelType.count()) === 0) {
    for (let i = 0; i < CHANNELS.length; i++) {
      await prisma.channelType.create({ data: { name: CHANNELS[i], sortOrder: i } });
    }
    console.log(`[seed] 채널 ${CHANNELS.length}개 생성`);
  }
  // 대행 상품 마스터
  if ((await prisma.product.count()) === 0) {
    for (let i = 0; i < PRODUCTS.length; i++) {
      await prisma.product.create({ data: { name: PRODUCTS[i].name, category: PRODUCTS[i].category, sortOrder: i } });
    }
    console.log(`[seed] 상품 마스터 ${PRODUCTS.length}개 생성`);
  }
  // 회사 정책 싱글턴
  if (!(await prisma.companySetting.findFirst())) {
    await prisma.companySetting.create({ data: {} });
    console.log("[seed] 회사 정책 생성");
  }
}

try {
  await seed();
  console.log("[seed] 완료");
} catch (err) {
  console.warn(`[seed] 실패(무시하고 빌드 계속): ${String(err).slice(0, 200)}`);
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
process.exit(0);
