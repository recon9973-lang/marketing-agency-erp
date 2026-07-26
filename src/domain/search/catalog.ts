// ERP 내부 검색 — 정적 카탈로그(페이지 바로가기 + 사용방법 도움말).
//
// 데이터(거래처·업무 등)는 서버 검색(repositories/search.ts)이 담당하고, 이 파일은
// "어디로 가면 되는지 / 어떻게 쓰는지"를 즉시(클라이언트) 검색되게 한다. 순수 함수 — DB 무관.
import { Role } from "@/domain/types";

export type CatalogKind = "page" | "help";

export type CatalogItem = {
  id: string;
  kind: CatalogKind;
  title: string;
  /** 검색 매칭용 키워드(한글·영문·로마자 별칭 포함). */
  keywords: string;
  /** 결과에 보여줄 한 줄 설명. */
  description: string;
  href: string;
  roles: Role[];
};

const ALL: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.MARKETER];
const ADMINS: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];
const OWNER: Role[] = [Role.SUPER_ADMIN];

// ── 페이지 바로가기 ─────────────────────────────────────────────
const PAGES: CatalogItem[] = [
  { id: "p-dashboard", kind: "page", title: "대시보드", href: "/dashboard", roles: ALL, keywords: "대시보드 홈 dashboard home 요약 현황", description: "오늘 업무·마감·정산 현황 요약" },
  { id: "p-clients", kind: "page", title: "거래처", href: "/clients", roles: ALL, keywords: "거래처 고객 병원 client 업체 목록", description: "거래처(병원) 목록·상세" },
  { id: "p-insights", kind: "page", title: "거래처 인사이트", href: "/insights", roles: ALL, keywords: "인사이트 insights 성과 채널 지표 방문자 순위", description: "거래처별 채널 성과·검색 순위" },
  { id: "p-contracts", kind: "page", title: "계약서", href: "/contracts", roles: ALL, keywords: "계약 계약서 contract 약정 서명", description: "계약서 작성·서명·관리" },
  { id: "p-work", kind: "page", title: "업무관리", href: "/work", roles: ALL, keywords: "업무 일감 task work 배정 진행 마감", description: "업무 배정·상태·마감 관리" },
  { id: "p-manuscript", kind: "page", title: "원고 스튜디오", href: "/manuscript", roles: ALL, keywords: "원고 글 콘텐츠 manuscript 작성 검수", description: "원고 작성·검수" },
  { id: "p-ai", kind: "page", title: "AI 마케팅", href: "/ai-studio", roles: ALL, keywords: "ai 인공지능 마케팅 생성 studio", description: "AI 마케팅 콘텐츠 생성" },
  { id: "p-image", kind: "page", title: "이미지 스튜디오", href: "/studio?tab=image", roles: ALL, keywords: "이미지 사진 image 생성 편집 studio", description: "이미지 생성·편집" },
  { id: "p-studio", kind: "page", title: "디자인 스튜디오", href: "/studio", roles: ALL, keywords: "디자인 카드뉴스 배너 썸네일 캔버스 편집기 design studio cardnews 포스팅 webp 내보내기", description: "카드뉴스·SNS·배너 디자인 편집·내보내기" },
  { id: "p-convert", kind: "page", title: "이미지 변환 도구", href: "/studio/convert", roles: ALL, keywords: "이미지 변환 webp jpg png 압축 리사이즈 용량 convert 최적화 zip 일괄", description: "이미지 일괄 WEBP/JPG/PNG 변환·압축·리사이즈" },
  { id: "p-brand", kind: "page", title: "브랜드킷", href: "/studio/brand", roles: ADMINS, keywords: "브랜드킷 brand kit 로고 컬러 색상 팔레트 폰트 거래처 브랜드 톤", description: "거래처별 로고·컬러·폰트 브랜드킷 관리" },
  { id: "p-compliance", kind: "page", title: "의료법 검수", href: "/compliance", roles: ALL, keywords: "의료법 검수 compliance 심의 위반 리스크", description: "의료광고법 위반 검수" },
  { id: "p-approvals", kind: "page", title: "승인함", href: "/approvals", roles: ALL, keywords: "승인 결재 approval 대기 컨펌", description: "승인·결재 대기 항목" },
  { id: "p-meetings", kind: "page", title: "회의록", href: "/meetings", roles: ALL, keywords: "회의 회의록 meeting 미팅 기록", description: "회의록 작성·조회" },
  { id: "p-keywords", kind: "page", title: "검색량 조회", href: "/keywords", roles: ALL, keywords: "검색량 키워드 keyword 조회 볼륨", description: "키워드 검색량 조회" },
  { id: "p-marketing", kind: "page", title: "마케팅 스튜디오", href: "/marketing-studio", roles: ALL, keywords: "마케팅 스튜디오 marketing studio 캠페인", description: "마케팅 캠페인 스튜디오" },
  { id: "p-leads", kind: "page", title: "영업 리드", href: "/leads", roles: ALL, keywords: "리드 영업 lead 잠재 신규 무료진단 seo", description: "영업 리드·무료 SEO 진단" },
  { id: "p-geo", kind: "page", title: "GEO (AI 검색)", href: "/geo", roles: ALL, keywords: "geo ai 검색 생성형 chatgpt perplexity 인용", description: "생성형 AI 검색 노출 모니터링" },
  { id: "p-magazine", kind: "page", title: "매거진", href: "/magazine", roles: ALL, keywords: "매거진 magazine 포스트 아티클 콘텐츠", description: "매거진 포스트" },
  { id: "p-calendar", kind: "page", title: "캘린더", href: "/calendar", roles: ALL, keywords: "캘린더 일정 calendar 스케줄 마감", description: "업무 일정 통합 보기" },
  { id: "p-finance", kind: "page", title: "정산/지출", href: "/finance", roles: ADMINS, keywords: "정산 지출 finance 청구 입금 비용 매출", description: "청구·입금·지출 관리" },
  { id: "p-leave", kind: "page", title: "연차/휴가", href: "/reports?doc=leave", roles: ALL, keywords: "연차 휴가 leave 반차 신청 잔여", description: "연차·휴가 신청·현황" },
  { id: "p-weekly", kind: "page", title: "주간보고", href: "/reports?doc=weekly", roles: ALL, keywords: "주간 주간보고 weekly 보고", description: "주간 업무 보고" },
  { id: "p-reports", kind: "page", title: "보고서", href: "/reports", roles: ALL, keywords: "보고서 리포트 report 월간 성과", description: "월간 보고서 작성·전달" },
  { id: "p-vault", kind: "page", title: "보관함", href: "/vault", roles: ALL, keywords: "보관함 파일 문서 vault 자료 다운로드 업로드", description: "파일·문서 보관함" },
  { id: "p-integrations", kind: "page", title: "연동", href: "/integrations", roles: OWNER, keywords: "연동 통합 integration api 계정", description: "외부 서비스 연동" },
  { id: "p-chat", kind: "page", title: "채팅", href: "/chat", roles: ALL, keywords: "채팅 chat 메시지 대화 협업", description: "팀 채팅·협업방" },
  { id: "p-seo", kind: "page", title: "SEO 진단", href: "/seo", roles: ALL, keywords: "seo 진단 검색 최적화 점수 사이트 검사", description: "홈페이지 SEO 진단·점수" },
  { id: "p-market", kind: "page", title: "상권분석", href: "/market", roles: ALL, keywords: "상권 분석 지역 인구 병원 밀집 market", description: "지역 상권·경쟁 밀집 분석" },
  { id: "p-strategy", kind: "page", title: "마케팅 전략", href: "/strategy", roles: ALL, keywords: "전략 마케팅 strategy 컨설팅 방향", description: "거래처 마케팅 전략 수립" },
  { id: "p-journeymap", kind: "page", title: "키워드 여정맵", href: "/journeymap", roles: ALL, keywords: "키워드 여정 여정맵 마인드맵 검색여정 journeymap 연관키워드", description: "키워드 검색여정 마인드맵·진단" },
  { id: "p-worklog", kind: "page", title: "업무 보고", href: "/worklog", roles: ALL, keywords: "업무 보고 일지 worklog 기록", description: "업무 보고·일지" },
  { id: "p-ideas", kind: "page", title: "아이디어", href: "/ideas", roles: ALL, keywords: "아이디어 idea 메모 제안", description: "아이디어 보드" },
  { id: "p-geo-monitor", kind: "page", title: "모니터링", href: "/geo-monitor", roles: ALL, keywords: "모니터링 monitor 추이 언급률 순위 월보장 리포트 관측", description: "AI 언급률·월보장 순위 모니터링" },
  { id: "p-account", kind: "page", title: "계정·비밀번호", href: "/account", roles: ALL, keywords: "계정 비밀번호 account password 변경 보안", description: "내 계정·비밀번호 관리" },
  { id: "p-notices", kind: "page", title: "검색엔진 공지", href: "/notices", roles: ALL, keywords: "공지 notices 검색엔진 구글 네이버 알고리즘 업데이트", description: "검색엔진 알고리즘·공지 모음" },
  { id: "p-settings", kind: "page", title: "직원/권한", href: "/settings", roles: OWNER, keywords: "직원 권한 설정 settings 계정 역할 admin", description: "직원 계정·권한 설정" }
];

// ── 사용방법(도움말) ─────────────────────────────────────────────
const HELP: CatalogItem[] = [
  { id: "h-client-add", kind: "help", title: "거래처 등록하는 법", href: "/clients", roles: ALL, keywords: "거래처 등록 추가 신규 만들기 생성 client 새 병원", description: "거래처 화면 우측 상단 '거래처 등록'에서 병원 정보를 입력합니다." },
  { id: "h-contract", kind: "help", title: "계약서 작성·서명", href: "/contracts", roles: ALL, keywords: "계약 작성 서명 만들기 contract 상품 추가", description: "계약서 화면에서 새 계약을 만들고 상품·기간을 넣은 뒤 서명 처리합니다." },
  { id: "h-work", kind: "help", title: "업무 배정·상태 변경", href: "/work", roles: ALL, keywords: "업무 배정 담당 상태 진행 완료 마감 task 변경", description: "업무관리에서 담당자·마감을 지정하고 진행/완료 상태를 바꿉니다." },
  { id: "h-manuscript", kind: "help", title: "원고 작성·검수 요청", href: "/manuscript", roles: ALL, keywords: "원고 작성 검수 승인 글 콘텐츠 요청", description: "원고 스튜디오에서 초안을 쓰고 검수·승인 흐름으로 넘깁니다." },
  { id: "h-compliance", kind: "help", title: "의료법 검수 돌리기", href: "/compliance", roles: ALL, keywords: "의료법 검수 심의 위반 검사 광고법 돌리기", description: "의료법 검수에서 문구를 넣고 위반 위험 항목을 점검합니다." },
  { id: "h-seo-audit", kind: "help", title: "SEO 자동진단 실행(리드)", href: "/leads", roles: ALL, keywords: "seo 진단 자동 검사 리드 무료진단 홈페이지 venom 점수", description: "리드 상세에서 홈페이지 URL로 'SEO 자동 진단'을 실행해 점수·개선항목을 봅니다." },
  { id: "h-report", kind: "help", title: "월간 보고서 만들기", href: "/reports", roles: ALL, keywords: "보고서 월간 만들기 작성 성과 리포트 전달", description: "보고서에서 거래처·월을 골라 성과 보고서를 만들고 전달합니다." },
  { id: "h-leave", kind: "help", title: "연차/휴가 신청", href: "/reports?doc=leave", roles: ALL, keywords: "연차 휴가 반차 신청 잔여 일수 승인", description: "연차/휴가에서 기간을 선택해 신청하면 관리자 승인으로 반영됩니다." },
  { id: "h-weekly", kind: "help", title: "주간보고 작성", href: "/reports?doc=weekly", roles: ALL, keywords: "주간 보고 작성 제출 이번주", description: "주간보고에서 이번 주 업무를 정리해 제출합니다." },
  { id: "h-vault", kind: "help", title: "파일 보관함 업로드·찾기", href: "/vault", roles: ALL, keywords: "파일 문서 업로드 다운로드 찾기 보관함 폴더 자료", description: "보관함에서 폴더별로 파일을 올리고 이름으로 찾습니다." },
  { id: "h-meeting", kind: "help", title: "회의록 작성", href: "/meetings", roles: ALL, keywords: "회의 회의록 작성 기록 미팅 참석", description: "회의록에서 새 회의를 만들고 참석자·내용을 기록합니다." },
  { id: "h-keyword", kind: "help", title: "검색량 조회하기", href: "/keywords", roles: ALL, keywords: "검색량 키워드 조회 볼륨 네이버", description: "검색량 조회에서 키워드를 넣어 월간 검색량을 확인합니다." },
  { id: "h-finance", kind: "help", title: "정산·지출 입력", href: "/finance", roles: ADMINS, keywords: "정산 지출 청구 입금 비용 입력 매출", description: "정산/지출에서 청구·입금·지출 내역을 입력·검토합니다." },
  { id: "h-settings", kind: "help", title: "직원 추가·권한 설정", href: "/settings", roles: OWNER, keywords: "직원 추가 권한 역할 설정 계정 초대 admin", description: "직원/권한에서 계정을 추가하고 역할·접근 범위를 지정합니다." },
  { id: "h-theme", kind: "help", title: "다크모드 전환", href: "/dashboard", roles: ALL, keywords: "다크모드 라이트 테마 화면 색상 dark light theme 야간", description: "화면 우측 상단 헤더의 테마 버튼으로 라이트/다크를 전환합니다." },
  { id: "h-convert", kind: "help", title: "이미지 WEBP로 변환·압축", href: "/studio/convert", roles: ALL, keywords: "webp 변환 압축 용량 줄이기 이미지 최적화 리사이즈 jpg png zip", description: "이미지 변환 도구에서 여러 장을 WEBP로 일괄 변환·압축해 ZIP으로 받습니다." }
];

const CATALOG: CatalogItem[] = [...PAGES, ...HELP];

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * 카탈로그를 질의로 검색(순수·클라이언트 사용 가능). 역할로 필터링하고, 제목 우선·부분일치.
 */
export function searchCatalog(query: string, role: Role, limit = 8): CatalogItem[] {
  const q = norm(query);
  if (!q) return [];
  const terms = q.split(" ").filter(Boolean);
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of CATALOG) {
    if (!item.roles.includes(role)) continue;
    const hay = norm(`${item.title} ${item.keywords}`);
    const title = norm(item.title);
    let ok = true;
    let score = 0;
    for (const t of terms) {
      if (!hay.includes(t)) {
        ok = false;
        break;
      }
      if (title.includes(t)) score += 3;
      if (title.startsWith(t)) score += 2;
      score += 1;
    }
    if (!ok) continue;
    if (item.kind === "page") score += 1; // 바로가기 살짝 우선
    scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return scored.slice(0, limit).map((s) => s.item);
}
