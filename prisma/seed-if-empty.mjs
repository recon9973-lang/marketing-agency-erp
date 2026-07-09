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

// 서식(문서 템플릿) — 예시 내용, {중괄호}는 자리표시자. 관리자가 이후 추가/수정/삭제.
const AGENCY = `(을)\n회  사  명 : 주식회사 베놈\n주      소 : 대구광역시 수성구 용학로25길54, 5층\n사업자번호 : 291-86-02777\n대      표 : 김보형 (인/서명)\n연  락  처 : 1661-4142`;
const SCOPE = `제 2 조 【광고 품목 및 대행 범위】\n  온라인: [ ] 블로그(브랜드/배포/상위노출/인플루언서)  [ ] SNS  [ ] 플레이스(SEO/리뷰)  [ ] 파워링크  [ ] 기타(지식iN/뉴스/카페/홈페이지)\n  오프라인: [ ] 전광판  [ ] 버스/택시  [ ] 지하철  [ ] 마트  [ ] 전단지/현수막/X배너/사진촬영`;
const TEMPLATES = [
  { name: "광고 업무 대행 계약서 (고객용)", category: "CONTRACT", minRole: "MARKETER", sortOrder: 0, title: "광고 업무 대행 계약서",
    body: `광고 업무 대행 계약서 (고객용)\n\n광고주 {거래처명} (이하 "갑")과 주식회사 베놈(이하 "을")은 아래와 같이 광고 업무 대행에 관하여 계약을 체결한다.\n\n제 1 조 【계약의 목적】\n  본 계약은 "갑"이 "을"에게 광고 업무 대행을 위임하여 상호 신뢰로서 업무를 진행함에 있다.\n\n${SCOPE}\n\n제 3 조 【광고비】\n  광고비는 매월 {금액}원(VAT 포함)으로 책정하며, 협의를 통해 변동된다.\n\n제 4 조 【지불조건】\n  첫 진행 전 선결제를 원칙으로 하고, 월간 단위로 정산·청구한다.\n\n제 5 조 【계약기간】\n  본 계약은 {시작일}부터 {종료일}까지로 하며, 특별한 사유가 없으면 1년마다 자동 갱신된다.\n\n(갑)\n회  사  명 : {거래처명}\n주      소 : {주소}\n사업자번호 : {사업자번호}\n대      표 : {대표자} (인/서명)\n\n${AGENCY}` },
  { name: "광고 업무 대행 계약서 (업체용)", category: "CONTRACT", minRole: "MARKETER", sortOrder: 1, title: "광고 업무 대행 계약서",
    body: `광고 업무 대행 계약서 (업체용)\n\n광고주 {거래처명} (이하 "갑")과 주식회사 베놈(이하 "을")은 광고 업무 대행에 관하여 계약을 체결한다.\n\n${SCOPE}\n\n제 3 조 【광고비 및 지불조건】\n  매월 {금액}원(VAT 포함), 월간 정산·선결제 원칙.\n\n제 4 조 【계약기간】\n  {시작일}부터 {종료일}까지, 1년마다 자동 갱신.\n\n(갑) {거래처명}  대표 {대표자} (인)\n\n${AGENCY}` },
  { name: "비밀유지 서약서 (거래처용)", category: "CLIENT", minRole: "MARKETER", sortOrder: 0, title: "비밀유지 서약서",
    body: `비밀유지 서약서\n\n당사(임직원 일동)는 {거래처명}(이하 "업체")의 온라인 광고 대행 업무를 수행함에 있어 다음을 준수할 것을 서약합니다.\n\n1. 소관 업무가 "업체"의 기밀에 관한 사항임을 인정한다.\n2. 계약으로 얻은 정보·비밀을 이행 전·후를 막론하고 외부에 누설하지 않는다.\n3. 위반 시 관련 법규에 의한 조치에 따른다.\n\n{작성일}\n\n${AGENCY}\n\n{거래처명} 귀중` },
  { name: "표준근로계약서 (기간의 정함이 없는 경우)", category: "HR", minRole: "ADMIN", sortOrder: 0, title: "표준근로계약서",
    body: `표준근로계약서 (기간의 정함이 없는 경우)\n\n주식회사 베놈(이하 "사업주")과 {성명}(이하 "근로자")은 다음과 같이 근로계약을 체결한다.\n\n1. 근로계약기간 : {입사일}부터\n2. 근무장소 : 주식회사 베놈\n3. 업무내용 : {업무내용}\n4. 소정근로시간 : 09:00~18:00 (휴게 12:00~13:00)\n5. 근무일/휴일 : 주 5일, 주휴일(법정공휴일 및 주말)\n6. 임금 : 월 {월급}원(공제 전), 지급일 매월 10일\n7. 연차유급휴가 : 근로기준법에 따름\n8. 사회보험 : 고용·산재·국민연금·건강보험 적용\n\n{작성일}\n(사업주) 주식회사 베놈  대표 김보형 (서명)\n(근로자) 성명 {성명} (서명)` },
  { name: "표준근로계약서 (기간의 정함이 있는 경우)", category: "HR", minRole: "ADMIN", sortOrder: 1, title: "표준근로계약서",
    body: `표준근로계약서 (기간의 정함이 있는 경우)\n\n주식회사 베놈(이하 "사업주")과 {성명}(이하 "근로자")은 다음과 같이 근로계약을 체결한다.\n\n1. 근로계약기간 : {시작일}부터 {종료일}까지\n2. 근무장소 : 주식회사 베놈\n3. 업무내용 : {업무내용}\n4. 소정근로시간 : 09:00~18:00 (휴게 12:00~13:00)\n5. 임금 : 월 {월급}원(공제 전), 지급일 매월 10일\n6. 수습기간 : {수습개월}개월\n\n{작성일}\n(사업주) 주식회사 베놈  대표 김보형 (서명)\n(근로자) 성명 {성명} (서명)` },
  { name: "재직증명서", category: "HR", minRole: "ADMIN", sortOrder: 2, title: "재직증명서",
    body: `재 직 증 명 서\n\n[인적사항] 성명 {성명}  /  주소 {주소}\n[재직사항] 회사 주식회사 베놈  /  부서 {부서}  /  직위 {직위}  /  입사일 {입사일}  /  근속기간 {근속기간}\n[발급용도] {발급용도}\n\n상기인은 발급일 현재 위와 같이 당사에 재직하고 있음을 증명합니다.\n\n{발급일}\n주식회사 베놈 대표이사 김보형 (인)` }
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
  // 서식(문서 템플릿)
  if ((await prisma.documentTemplate.count()) === 0) {
    for (const t of TEMPLATES) {
      await prisma.documentTemplate.create({ data: { name: t.name, category: t.category, title: t.title, body: t.body, minRole: t.minRole, sortOrder: t.sortOrder } });
    }
    console.log(`[seed] 서식 ${TEMPLATES.length}개 생성`);
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
