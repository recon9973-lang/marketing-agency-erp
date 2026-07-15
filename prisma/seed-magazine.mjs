/**
 * GROUND(seokorea.org) 매거진 큐 시딩 — 확정된 SEO/GEO/AEO 시리즈 주제를 QUEUED로 넣는다(멱등).
 * 이미 같은 제목이 있으면 건너뛴다. 실패해도 빌드를 막지 않는다(exit 0).
 * seed(한 줄 정의)는 AI 초안 생성의 힌트로 쓰인다.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.warn("[seed-magazine] DATABASE_URL 미설정 — 스킵");
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");

// GROUND 자사 미디어 시리즈 — 검색이 사라지는 시대의 마케팅 용어를 쉽게 풀어주는 매거진.
const TOPICS = [
  // AEO/GEO 트랙
  { category: "AEO/GEO", title: "GEO(생성형 엔진 최적화)", seed: "생성형 AI 답변에 우리 콘텐츠가 인용되게 만드는 최적화. 검색 1등이 아니라 'AI가 고르는 답'이 되는 것." },
  { category: "AEO/GEO", title: "AEO(답변 엔진 최적화)", seed: "검색·AI의 답변 영역에 선택되도록 질문–답 형식·출처·FAQ 구조로 콘텐츠를 정리하는 최적화." },
  { category: "AEO/GEO", title: "E-E-A-T", seed: "경험·전문성·권위·신뢰. AI가 인용할 콘텐츠를 고르는 신뢰 기준. 저자·출처가 투명해야 유리." },
  { category: "AEO/GEO", title: "구조화 데이터(스키마)", seed: "FAQ·HowTo·Article 스키마로 콘텐츠에 라벨을 붙여 검색엔진·AI가 이해하기 쉽게 만드는 마크업." },
  { category: "AEO/GEO", title: "llms.txt", seed: "AI 크롤러에게 사이트 핵심 페이지를 안내하는 파일. 루트에 두고 요약·핵심 링크를 정리한다." },
  { category: "AEO/GEO", title: "지식그래프", seed: "개체(브랜드·인물·장소)와 관계를 구조화한 지식 네트워크. AI 답변의 근거로 활용된다." },
  { category: "AEO/GEO", title: "시맨틱 검색", seed: "키워드 일치가 아니라 의미·의도를 이해해 답을 찾는 검색. 문맥·개체 중심 콘텐츠가 유리." },
  { category: "AEO/GEO", title: "제로클릭 검색", seed: "검색 결과 화면에서 답을 바로 얻어 클릭 없이 끝나는 검색. 스니펫·답변 영역 선점이 관건." },
  // SEO 트랙
  { category: "SEO", title: "SEO(검색 최적화)", seed: "사람이 진짜 궁금한 걸 명확히 답하고, 검색엔진·AI가 둘 다 이해하게 정리하는 것. 키워드 나열이 아님." },
  { category: "SEO", title: "백링크에서 멘션으로", seed: "링크 개수보다 신뢰할 곳에서의 '언급'이 중요해진 흐름. 억지 링크보다 자연스러운 맥락의 멘션." },
  { category: "SEO", title: "네이버 스마트블록", seed: "네이버가 의도를 파악해 주제별 묶음·답을 상단에 올려주는 영역. 명확한 질문–답·최신성·구조화가 핵심." },
  { category: "SEO", title: "NAP 일관성", seed: "상호·주소·전화(Name·Address·Phone)를 채널마다 동일하게 유지해 로컬 신뢰도를 높이는 원칙." },
  { category: "SEO", title: "검색의도", seed: "정보형·거래형·탐색형 등 사용자가 검색으로 이루려는 목적. 의도에 맞춰 콘텐츠 형식을 설계한다." },
  { category: "SEO", title: "롱테일 키워드", seed: "구체적이고 경쟁이 낮은 여러 단어 조합의 질문형 키워드. 전환율이 높고 AEO에 유리." },
  { category: "SEO", title: "코어 웹 바이탈", seed: "로딩·상호작용·시각 안정성 등 사용자 경험 지표. 검색 순위와 체류에 영향을 준다." },
  { category: "SEO", title: "리치 스니펫", seed: "별점·FAQ·이미지 등 검색 결과를 풍부하게 보여주는 요소. 구조화 데이터로 활성화된다." }
];

const prisma = new PrismaClient({ datasources: { db: { url: direct } } });

async function main() {
  const titles = TOPICS.map((t) => t.title);
  const existing = await prisma.magazinePost.findMany({ where: { title: { in: titles } }, select: { title: true } });
  const have = new Set(existing.map((e) => e.title.toLowerCase()));
  const fresh = TOPICS.filter((t) => !have.has(t.title.toLowerCase()));
  if (fresh.length === 0) {
    console.log("[seed-magazine] 이미 시딩됨 — 스킵");
    return;
  }
  const res = await prisma.magazinePost.createMany({
    data: fresh.map((t) => ({ title: t.title, category: t.category, kind: "glossary", seed: t.seed, status: "QUEUED" }))
  });
  console.log(`[seed-magazine] GROUND 매거진 큐 시딩 ${res.count}건`);
}

main()
  .catch((e) => { console.warn("[seed-magazine] 실패(무시):", e?.message || e); })
  .finally(async () => { await prisma.$disconnect(); process.exit(0); });
