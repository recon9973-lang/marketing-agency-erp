/**
 * SEO/GEO 영업 워크플로우 백필(멱등·비파괴).
 *
 * 1) 상품 라인업(상품 소개서 01 기준) — 이름 기준으로 없을 때만 생성.
 * 2) "SEO·GEO 통합 패키지" 상품의 defaultTasks — NULL일 때만 표준 온보딩 10종 주입.
 *    (seed-if-empty는 데이터가 있으면 스킵되므로 기존 운영 DB에는 backfill로만 반영 가능)
 * 3) 데모 리드/GEO 질문 — 전역 개수 0일 때만 생성([데모] 마커).
 *
 * 실패해도 빌드를 막지 않음(exit 0). DB 미연결 시 스킵.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.warn("[seo-geo] DATABASE_URL 미설정 — 스킵");
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");
const prisma = new PrismaClient({ datasources: { db: { url: direct } }, log: ["error"] });

const D = "[데모]";

// 표준 온보딩 업무 — src/domain/sales/onboarding-tasks.ts 와 동기 유지(기획서 §11).
const STANDARD_ONBOARDING_TASKS = [
  { title: "계약서·견적서·미보장 문구 확인", category: "ACCOUNT_MANAGEMENT", offsetDays: 0, offsetFrom: "START" },
  { title: "자료 요청 폼 발송 (병원명·진료과·의료진·장비·진료시간·주소·전화·주차/교통·상담 가능 시간·대표 시술)", category: "ACCOUNT_MANAGEMENT", offsetDays: 1, offsetFrom: "START" },
  { title: "권한 요청 발송", category: "ACCOUNT_MANAGEMENT", offsetDays: 2, offsetFrom: "START", checklist: ["GSC", "GA4", "Google Business Profile", "네이버 서치어드바이저", "네이버 플레이스", "CMS", "도메인/DNS"] },
  { title: "금지·주의 표현 안내문 전달 + 병원 승인 담당자 1인 지정", category: "ACCOUNT_MANAGEMENT", offsetDays: 3, offsetFrom: "START", checklist: ["의료광고 금지 표현 안내문 발송", "병원 측 승인 담당자 지정 확인", "승인 채널(포털) 안내"] },
  { title: "초기 SEO 진단", category: "BLOG_SEO", offsetDays: 7, offsetFrom: "START", checklist: ["색인", "메타", "사이트맵", "robots", "모바일", "진료과 구조", "CTA", "프로필"] },
  { title: "SEO 기본 적용 (title/description·내부링크·진료과 랜딩·FAQ·전환 버튼)", category: "BLOG_SEO", offsetDays: 14, offsetFrom: "START" },
  { title: "GEO 질문 20개 (후보 생성·병원 승인·페이지 매핑·모니터링 기준)", category: "BLOG_SEO", offsetDays: 21, offsetFrom: "START" },
  { title: "콘텐츠 운영 시작 (월 콘텐츠 캘린더·초안·검수·승인·게시)", category: "BRAND_BLOG", offsetDays: 21, offsetFrom: "START" },
  { title: "월간 리포트 (데이터 수집·초안·PM 코멘트·원장 브리핑)", category: "MONTHLY_REPORT", offsetDays: 30, offsetFrom: "START" },
  { title: "재계약 제안 (성과 요약·업셀 후보·견적 발송)", category: "ACCOUNT_MANAGEMENT", offsetDays: -30, offsetFrom: "END" },
  { title: "계약종료 권한 회수 (GSC·GA4·GBP·네이버·CMS 접근 권한 해제)", category: "ACCOUNT_MANAGEMENT", offsetDays: 0, offsetFrom: "END" }
];

// 상품 라인업 — 상품 소개서(01) §2. 단위: 만원(설명에만 표기, 가격 필드는 계약에서 입력).
const SEO_GEO_PRODUCTS = [
  { name: "SEO 진단/리뉴얼", category: "SEO", description: "색인·메타·사이트맵·진료과 랜딩·CTA 개선 (70만원, 상위노출 보장 없음)" },
  { name: "신규 SEO형 홈페이지", category: "SEO", description: "검색 구조·진료과/질환 페이지·의료진/위치 신뢰 페이지 (200만원+, 범위별 견적)" },
  { name: "GEO 기반 구축 (질문 20개)", category: "GEO", description: "질문 20개 세트·FAQ·근거형 답변 페이지 (50만원+, AI답변 노출 보장 없음)" },
  { name: "AI 원고 콘텐츠", category: "콘텐츠", description: "AI 초안 생산·자체검수·기본 게시 (묶음 견적, 핵심 의료 페이지 단독 사용 지양)" },
  { name: "사람 검수 콘텐츠", category: "콘텐츠", description: "기획·작성·의료광고 체크·게시·리포팅 (묶음 견적, 검수 이력 보관)" },
  { name: "SEO·GEO 통합 패키지", category: "SEO", description: "SEO 리뉴얼 + GEO 질문 20개 + 월 콘텐츠 운영 (계약 시 표준 온보딩 업무 10종 자동 생성)" },
  { name: "AI 채널 구축 패키지", category: "GEO", description: "Schema/llms.txt·보도자료·YouTube·전문가 아티클·커뮤니티 Q&A·인용 모니터링 (계약 시 채널 업무 8종 자동 생성, AI답변 노출 보장 없음)" }
];

// AI 채널 구축 업무 — src/domain/sales/geo-channels.ts AI_CHANNEL_TASKS 와 동기 유지.
const AI_CHANNEL_TASKS = [
  { title: "[자동화 A] FAQPage/Article Schema 적용 + BLUF(답변 선두 배치) 구조 점검", category: "BLOG_SEO", offsetDays: 7, offsetFrom: "START", checklist: ["FAQ Schema", "Article Schema", "핵심 답변 첫 문단 배치", "구조 검증"] },
  { title: "[자동화 A] llms.txt 생성·업데이트 + 색인 요청 루틴 세팅", category: "BLOG_SEO", offsetDays: 10, offsetFrom: "START", checklist: ["llms.txt 생성", "사이트맵 갱신", "색인 요청 자동화 설정"] },
  { title: "[자동화 B] 언론 보도자료 1건 (AI 초안 → 원장 인용문·배포는 사람)", category: "BRAND_BLOG", offsetDays: 21, offsetFrom: "START", checklist: ["보도자료 초안", "의료광고 검수", "원장 인용문", "배포처 선정"] },
  { title: "[자동화 B] YouTube 진료 설명 영상 1건 + 자막(SRT)·제목/설명 SEO", category: "SNS_MANAGEMENT", offsetDays: 30, offsetFrom: "START", checklist: ["대본(의료광고 검수)", "촬영/편집", "자막 자동 생성", "제목·설명 최적화"] },
  { title: "[자동화 B] 의료진 전문가 아티클 게시 (LinkedIn/블로그 — E-E-A-T 신호)", category: "BRAND_BLOG", offsetDays: 30, offsetFrom: "START" },
  { title: "[자동화 C] 커뮤니티 Q&A 참여 — AI 초안만, 게시·소통은 사람 (지식iN·카페)", category: "SNS_MANAGEMENT", offsetDays: 30, offsetFrom: "START", checklist: ["질문 모니터링", "답변 초안(의료광고 검수)", "직접 게시", "이력 기록"] },
  { title: "[자동화 B] AI 인용 모니터링 루틴 — 승인 질문 20개 월 1회 실행·기록·캡처", category: "PERFORMANCE_COLLECTION", offsetDays: 30, offsetFrom: "START", checklist: ["엔진별 실행", "출현/인용 기록", "캡처 증빙", "경쟁사 언급 기록"] },
  { title: "[자동화 B] 분기 콘텐츠 전면 업데이트 계획 (Perplexity 최신성 70% 가중 대응)", category: "BRAND_BLOG", offsetDays: 80, offsetFrom: "START" }
];

async function seedProducts() {
  let created = 0;
  const maxSort = await prisma.product.count();
  for (let i = 0; i < SEO_GEO_PRODUCTS.length; i++) {
    const p = SEO_GEO_PRODUCTS[i];
    const exists = await prisma.product.findFirst({ where: { name: p.name }, select: { id: true } });
    if (exists) continue;
    await prisma.product.create({
      data: { name: p.name, category: p.category, description: p.description, sortOrder: maxSort + i }
    });
    created++;
  }
  return created;
}

/** defaultTasks가 비어 있는 패키지 상품에 업무 템플릿 주입(NULL일 때만 — 운영자 수정 보존). */
async function backfillDefaultTasks() {
  const targets = [
    { name: "SEO·GEO 통합 패키지", tasks: STANDARD_ONBOARDING_TASKS },
    { name: "AI 채널 구축 패키지", tasks: AI_CHANNEL_TASKS }
  ];
  let updated = 0;
  for (const t of targets) {
    const pkg = await prisma.product.findFirst({
      where: { name: t.name },
      select: { id: true, defaultTasks: true }
    });
    if (!pkg || pkg.defaultTasks !== null) continue;
    await prisma.product.update({ where: { id: pkg.id }, data: { defaultTasks: t.tasks } });
    updated++;
  }
  return updated;
}

const DEMO_LEADS = [
  { hospitalName: `${D} 한빛정형외과`, department: "정형외과", region: "서울 강남구", source: "무료진단 폼", status: "NEW", grade: "A" },
  { hospitalName: `${D} 미소플란트치과`, department: "치과", region: "성남 분당구", source: "콜드아웃", status: "CONTACTING", grade: "B" },
  {
    hospitalName: `${D} 맑은숨이비인후과`,
    department: "이비인후과",
    region: "서울 송파구",
    source: "소개",
    status: "AUDIT",
    grade: "A",
    auditChecklist: { indexing: true, meta: false, sitemap: true, robots: true, mobile: true, structure: false, cta: false, profile: true },
    auditScore: 63,
    auditNote: "문제: 메타 중복 다수, 진료과 랜딩 부재, 모바일 첫 화면 CTA 없음\n기회: 색인 양호, 플레이스 연동, FAQ 구조화 여지"
  },
  { hospitalName: `${D} 튼튼마디한의원`, department: "한의원", region: "수원 영통구", source: "리스트 업로드", status: "MEETING", grade: "B" },
  { hospitalName: `${D} 밝은눈안과`, department: "안과", region: "서울 서초구", source: "무료진단 폼", status: "PROPOSAL", grade: "A" },
  { hospitalName: `${D} 새봄피부과`, department: "피부과", region: "인천 연수구", source: "콜드아웃", status: "LOST", grade: "C", lostReason: "예산 부족 — 3개월 후 재접촉" }
];

async function seedLeads() {
  if ((await prisma.lead.count()) !== 0) return 0;
  const now = Date.now();
  await prisma.lead.createMany({
    data: DEMO_LEADS.map((l, i) => ({
      ...l,
      nextActionAt: l.status === "LOST" ? new Date(now + 90 * 86400000) : new Date(now + (i + 1) * 86400000),
      consentAt: new Date(),
      consentTextVersion: "v1-2026-07"
    }))
  });
  return DEMO_LEADS.length;
}

const DEMO_GEO_QUESTIONS = [
  { question: "어떤 증상이 있으면 정형외과에 가야 하나요?", type: "판단형", priority: 2, status: "MONITORING" },
  { question: "서울 강남구에서 정형외과 병원을 고르는 기준은 무엇인가요?", type: "지역형", priority: 1, status: "MONITORING" },
  { question: "정형외과 비수술 치료와 수술 치료는 어떻게 다른가요?", type: "비교형", priority: 3, status: "APPROVED" },
  { question: "정형외과 치료의 부작용이나 주의점은 무엇인가요?", type: "위험형", priority: 2, status: "CANDIDATE" }
];

async function seedGeo(clients) {
  if ((await prisma.geoQuestion.count()) !== 0) return 0;
  const client = clients[0];
  if (!client) return 0;
  let created = 0;
  for (const q of DEMO_GEO_QUESTIONS) {
    const question = await prisma.geoQuestion.create({
      data: {
        clientId: client.id,
        department: "정형외과",
        question: `${D} ${q.question}`,
        qtype: q.type,
        priority: q.priority,
        status: q.status,
        approvedAt: q.status === "CANDIDATE" ? null : new Date()
      }
    });
    created++;
    if (q.status === "MONITORING") {
      const day = new Date();
      day.setUTCHours(0, 0, 0, 0);
      await prisma.geoAnswerRecord.createMany({
        data: [
          { questionId: question.id, engine: "CHATGPT", checkedOn: day, appeared: true, cited: q.priority === 1, snippet: `${D} 지역 병원 선택 기준 답변에 병원명 언급` },
          { questionId: question.id, engine: "PERPLEXITY", checkedOn: day, appeared: q.priority === 1, cited: false }
        ],
        skipDuplicates: true
      });
    }
  }
  return created;
}

try {
  const p = await seedProducts();
  const t = await backfillDefaultTasks();
  const l = await seedLeads();
  const clients = await prisma.client.findMany({ where: { active: true }, select: { id: true }, take: 1 });
  const g = await seedGeo(clients);
  console.log(`[seo-geo] 백필 — 상품 ${p} · defaultTasks ${t} · 리드 ${l} · GEO질문 ${g}`);
} catch (err) {
  console.warn(`[seo-geo] 실패(무시하고 빌드 계속): ${String(err).slice(0, 200)}`);
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
process.exit(0);
