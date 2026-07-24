import "server-only";
/**
 * 마케팅 상담 진단 — 진행 중 거래처의 현황 신호를 한 판으로 합성한다.
 *
 * 목적: 컨설팅 상담 자리에서 "이 병원 마케팅이 지금 어디에 있고, 다음에 뭘 해야 하는가"를
 * 즉시 제시. 채널 노출·방문, 검색 순위, 키워드 커버리지, 상권·경쟁, 실행 현황을 각각
 * 신호등(good·watch·risk·nodata)으로 판정하고, 약한 영역에서 우선순위 대응 방향을 도출한다.
 *
 * 원칙: 결정형(규칙 기반) 합성. 신호가 없으면 nodata 로 정직 표기(추정 날조 금지).
 * 값의 근거는 모두 실측 데이터(insights 리포지토리·상권 엔진·WorkItem)에서 온다.
 */

export type Signal = "good" | "watch" | "risk" | "nodata";

/** 액션에서 실측 신호를 정규화해 넘기는 입력(합성은 순수 함수로 테스트 가능). */
export type ReviewInput = {
  hospitalName: string;
  region: string;
  departments: string[];
  // 채널·검색 현황(insights 리포지토리에서 스칼라로 정규화)
  hasChannelData: boolean;
  hasRankData: boolean;
  totalImpressions: number;
  totalVisitors: number;
  impressionTrend: number | null; // 최근/초기 비율(1.0=보합, >1 상승)
  visitorTrend: number | null;
  rankAvg: number | null; // 추적 키워드 평균 순위(낮을수록 좋음)
  rankNetDelta: number | null; // 순위 순변화 합(음수=개선)
  trackedKeywords: number;
  coreKeywordCount: number;
  relatedCount: number;
  // 상권·경쟁(상권 엔진)
  scoreGrade: string | null; // A|B|C|D
  scoreOverall: number | null;
  competitionPer: number | null; // 만명당 병·의원
  nationalPer: number | null;
  openingsY1: number | null; // 최근 1년 개원(경쟁 심화 신호)
  incomeIndex: number | null;
  accessLabel: string | null;
  // 실행 현황(WorkItem 집계)
  work: { total: number; completed: number; active: number; blocked: number; overdue: number } | null;
};

export type ReviewArea = {
  key: string;
  label: string;
  status: Signal;
  signal: string; // 한 줄 진단
  metric: string | null; // 대표 수치
};

export type ReviewAction = {
  priority: 1 | 2 | 3;
  area: string;
  title: string;
  why: string;
  how: string;
};

export type ConsultingReview = {
  hospitalName: string;
  headline: string;
  stage: string; // 마케팅 단계
  stageNote: string;
  overallScore: number; // 0~100(가용 영역 가중 평균)
  areas: ReviewArea[];
  actions: ReviewAction[];
  dataGaps: string[]; // 신호가 비어 진단이 제한된 지점(정직)
};

const SCORE: Record<Signal, number> = { good: 85, watch: 55, risk: 25, nodata: 0 };

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 채널 노출·획득 판정. */
function areaExposure(inp: ReviewInput): ReviewArea {
  if (!inp.hasChannelData || inp.totalImpressions <= 0)
    return { key: "exposure", label: "검색 노출·획득", status: "nodata", signal: "채널 노출 지표 미수집 — 플레이스·블로그·홈페이지 지표 연결 필요", metric: null };
  const t = inp.impressionTrend;
  const metric = `노출 ${fmt(inp.totalImpressions)} (최근 기간)`;
  if (t != null && t >= 1.1) return { key: "exposure", label: "검색 노출·획득", status: "good", signal: "노출 상승세 — 상단 퍼널 유입이 확대되는 국면", metric };
  if (t != null && t <= 0.9) return { key: "exposure", label: "검색 노출·획득", status: "watch", signal: "노출 감소세 — 콘텐츠 발행·광고 노출 점검 필요", metric };
  return { key: "exposure", label: "검색 노출·획득", status: "watch", signal: "노출 보합 — 신규 유입 확대 여지", metric };
}

/** 방문·유입 판정. */
function areaVisitors(inp: ReviewInput): ReviewArea {
  if (!inp.hasChannelData || inp.totalVisitors <= 0)
    return { key: "visitors", label: "방문·유입", status: "nodata", signal: "방문자 지표 미수집", metric: null };
  const t = inp.visitorTrend;
  const metric = `방문 ${fmt(inp.totalVisitors)}`;
  if (t != null && t >= 1.1) return { key: "visitors", label: "방문·유입", status: "good", signal: "방문 증가 — 유입이 실제 트래픽으로 전환 중", metric };
  if (t != null && t <= 0.9) return { key: "visitors", label: "방문·유입", status: "watch", signal: "방문 감소 — 노출 대비 유입 효율·랜딩 점검", metric };
  return { key: "visitors", label: "방문·유입", status: "watch", signal: "방문 보합", metric };
}

/** 검색 순위·전환신호 판정(순위 낮을수록 좋음). */
function areaRank(inp: ReviewInput): ReviewArea {
  if (!inp.hasRankData || inp.rankAvg == null)
    return { key: "rank", label: "검색 순위·전환신호", status: "nodata", signal: "순위 추적 기록 없음 — 핵심 키워드 순위 추적 시작 필요", metric: null };
  const metric = `평균 ${inp.rankAvg}위`;
  const improving = inp.rankNetDelta != null && inp.rankNetDelta < 0;
  const declining = inp.rankNetDelta != null && inp.rankNetDelta > 0;
  if (inp.rankAvg <= 5) return { key: "rank", label: "검색 순위·전환신호", status: "good", signal: "핵심 키워드 상위 노출 — 전환 접점 확보", metric };
  if (improving) return { key: "rank", label: "검색 순위·전환신호", status: "watch", signal: "순위 상승 중이나 상위권 진입 전 — 상위 고정 집중", metric };
  if (declining) return { key: "rank", label: "검색 순위·전환신호", status: "risk", signal: "순위 하락 — 경쟁 심화·콘텐츠 노후 신호", metric };
  return { key: "rank", label: "검색 순위·전환신호", status: "watch", signal: "중위권 정체 — 상위 진입 콘텐츠 보강 필요", metric };
}

/** 키워드 커버리지 판정. */
function areaKeywords(inp: ReviewInput): ReviewArea {
  const total = inp.coreKeywordCount + inp.trackedKeywords;
  if (total <= 0)
    return { key: "keywords", label: "키워드 커버리지", status: "nodata", signal: "등록·추적 키워드 없음 — 키워드 워크스페이스에서 확장 필요", metric: null };
  const metric = `핵심 ${inp.coreKeywordCount} · 추적 ${inp.trackedKeywords}`;
  if (inp.coreKeywordCount >= 10) return { key: "keywords", label: "키워드 커버리지", status: "good", signal: "핵심 키워드군 확보 — 여정 단계별 커버리지 양호", metric };
  return { key: "keywords", label: "키워드 커버리지", status: "watch", signal: "키워드군 얕음 — 증상·비교·지역 의도로 확장 여지", metric };
}

/** 상권·경쟁 포지션 판정. */
function areaMarket(inp: ReviewInput): ReviewArea {
  if (!inp.scoreGrade || inp.scoreOverall == null)
    return { key: "market", label: "상권·경쟁 포지션", status: "nodata", signal: "상권 분석 미해결 — 지역 정보 확인 필요", metric: null };
  const dense =
    inp.competitionPer != null && inp.nationalPer
      ? inp.competitionPer >= inp.nationalPer * 1.2
        ? "과밀"
        : inp.competitionPer <= inp.nationalPer * 0.8
          ? "여유"
          : "평균"
      : "—";
  const metric = `${inp.scoreGrade}등급 ${inp.scoreOverall}/100 · 경쟁 ${dense}`;
  if (inp.scoreGrade === "A" || inp.scoreGrade === "B")
    return { key: "market", label: "상권·경쟁 포지션", status: "good", signal: `상권 여건 우호(${dense}) — 공급 대비 수요 우위 활용`, metric };
  if (inp.scoreGrade === "D")
    return { key: "market", label: "상권·경쟁 포지션", status: "risk", signal: `경쟁 과밀·수요 열위 — 차별화·틈새 진료 포지셔닝 필수`, metric };
  return { key: "market", label: "상권·경쟁 포지션", status: "watch", signal: `상권 보통(${dense}) — 검색 점유 선점이 관건`, metric };
}

/** 실행 현황 판정(WorkItem). */
function areaExecution(inp: ReviewInput): ReviewArea {
  if (!inp.work || inp.work.total <= 0)
    return { key: "execution", label: "실행 현황", status: "nodata", signal: "등록된 업무 없음 — 실행 과제 미연결", metric: null };
  const w = inp.work;
  const metric = `진행 ${w.active} · 완료 ${w.completed} · 지연 ${w.overdue}`;
  if (w.blocked > 0 || w.overdue >= 3) return { key: "execution", label: "실행 현황", status: "risk", signal: "지연·중단 업무 누적 — 실행 병목 해소 필요", metric };
  if (w.overdue > 0) return { key: "execution", label: "실행 현황", status: "watch", signal: "일부 마감 초과 — 우선순위 재조정 필요", metric };
  return { key: "execution", label: "실행 현황", status: "good", signal: "업무 정상 진행", metric };
}

// 영역별 → 대응 방향(약한 영역에서 도출). risk=우선순위1, watch=2.
const ACTION_MAP: Record<string, { title: string; why: string; how: string }> = {
  exposure: { title: "검색 노출 확대 캠페인", why: "상단 퍼널 유입이 정체/감소하면 하위 전환도 마른다", how: "증상·질환 정보 콘텐츠 발행 주기 상향 + 파워링크/플레이스 노출 점검" },
  visitors: { title: "유입 효율·랜딩 개선", why: "노출 대비 방문이 낮으면 메시지·썸네일·랜딩 이탈 문제", how: "핵심 키워드 랜딩의 첫 화면·CTA 재구성, 상담 동선 단축" },
  rank: { title: "핵심 키워드 상위 고정", why: "중위권·하락은 전환 접점을 경쟁사에 내주는 것", how: "상위 노출 콘텐츠 리라이트 + 내부링크·후속 콘텐츠로 주제 권위 강화" },
  keywords: { title: "키워드 커버리지 확장", why: "얕은 키워드군은 여정 단계별 유입 공백을 만든다", how: "증상·치료비교·지역·후기 의도로 연관키워드 확장 후 여정 매핑" },
  market: { title: "상권 맞춤 포지셔닝", why: "경쟁 과밀 상권에서 일반 소구는 매몰된다", how: "상권 수요 상위 진료·틈새 시술 중심으로 메시지·채널 재배분" },
  execution: { title: "실행 병목 해소", why: "지연·중단이 쌓이면 전략이 성과로 연결되지 않는다", how: "중단 업무 원인 분류 → 담당·마감 재배정, 주간 실행 점검 도입" }
};

/** 신호 → 우선순위 대응 방향. */
function deriveActions(areas: ReviewArea[]): ReviewAction[] {
  const out: ReviewAction[] = [];
  for (const a of areas) {
    if (a.status !== "risk" && a.status !== "watch") continue;
    const m = ACTION_MAP[a.key];
    if (!m) continue;
    out.push({ priority: a.status === "risk" ? 1 : 2, area: a.label, title: m.title, why: m.why, how: m.how });
  }
  out.sort((x, y) => x.priority - y.priority);
  return out;
}

/** 강한/약한 영역으로 마케팅 단계 추정. */
function inferStage(areas: ReviewArea[]): { stage: string; note: string } {
  const by = (k: string) => areas.find((a) => a.key === k)?.status;
  const exposure = by("exposure");
  const rank = by("rank");
  const exposureWeak = exposure === "nodata" || exposure === "risk" || exposure === "watch";
  const rankWeak = rank === "nodata" || rank === "risk" || rank === "watch";
  if (exposureWeak && rankWeak) return { stage: "인지·노출 확보기", note: "노출과 순위 기반이 아직 얇다. 유입 접점을 먼저 넓히는 단계." };
  if (!exposureWeak && rankWeak) return { stage: "전환 최적화기", note: "노출은 확보됐다. 상위 순위·랜딩으로 전환을 끌어올리는 단계." };
  if (!exposureWeak && !rankWeak) return { stage: "리텐션·확장기", note: "핵심 지표가 안정적이다. 신규 진료·채널로 확장하는 단계." };
  return { stage: "진단 데이터 확충기", note: "핵심 신호가 비어 있어 우선 데이터 연결이 필요한 단계." };
}

export function buildConsultingReview(inp: ReviewInput): ConsultingReview {
  const areas: ReviewArea[] = [
    areaExposure(inp),
    areaVisitors(inp),
    areaRank(inp),
    areaKeywords(inp),
    areaMarket(inp),
    areaExecution(inp)
  ];
  const scored = areas.filter((a) => a.status !== "nodata");
  const overallScore = scored.length ? Math.round(scored.reduce((s, a) => s + SCORE[a.status], 0) / scored.length) : 0;
  const { stage, note } = inferStage(areas);
  const actions = deriveActions(areas);
  const dataGaps = areas.filter((a) => a.status === "nodata").map((a) => a.label);

  const riskCount = areas.filter((a) => a.status === "risk").length;
  const goodCount = areas.filter((a) => a.status === "good").length;
  let headline: string;
  if (dataGaps.length >= 4) headline = `${inp.hospitalName} — 진단에 필요한 실측 신호가 부족합니다. 데이터 연결이 급선무입니다.`;
  else if (riskCount >= 2) headline = `${inp.hospitalName} — 즉시 대응이 필요한 위험 영역이 ${riskCount}곳 있습니다.`;
  else if (goodCount >= 4) headline = `${inp.hospitalName} — 핵심 지표가 안정적입니다. 확장·리텐션에 집중할 때입니다.`;
  else headline = `${inp.hospitalName} — ${stage}. 우선순위 대응 ${actions.length}건을 제안합니다.`;

  return { hospitalName: inp.hospitalName, headline, stage, stageNote: note, overallScore, areas, actions, dataGaps };
}

// ── 신규 수주 진단(90%) — 프로스펙트 상권·경쟁 기회 → 수주 대응 방향 ──────────────
/** /market 상권분석 신호에서 정규화한 수주 진단 입력. */
export type AcquisitionInput = {
  hospitalName: string; // 브랜드 또는 "(신규 병원)"
  region: string;
  specialty: string | null;
  populationTotal: number | null;
  femaleRatio: number | null;
  populationDelta: number | null; // 전월 증감
  perTenThousand: number | null; // 만명당 병·의원
  nationalPer: number | null;
  openingsY1: number | null; // 최근 1년 개원(경쟁 심화)
  scoreGrade: string | null;
  scoreOverall: number | null;
  incomeIndex: number | null;
  accessLevel: number | null;
  accessLabel: string | null;
  demandRows: number; // 진료과 수요 상병 수(수요 구조 확보 여부)
};

function areaDemand(inp: AcquisitionInput): ReviewArea {
  if (inp.populationTotal == null)
    return { key: "demand", label: "수요 규모", status: "nodata", signal: "상권 인구 미해결 — 지역 확인 필요", metric: null };
  const metric = `상권 인구 ${fmt(inp.populationTotal)}명`;
  if (inp.populationTotal >= 300000) return { key: "demand", label: "수요 규모", status: "good", signal: "대형 상권 — 진료과 수요 모수 충분", metric };
  if (inp.populationTotal >= 120000) return { key: "demand", label: "수요 규모", status: "watch", signal: "중형 상권 — 타깃 진료 집중 필요", metric };
  return { key: "demand", label: "수요 규모", status: "watch", signal: "소형 상권 — 좁은 타깃·리텐션 전략 유효", metric };
}

function areaCompetition(inp: AcquisitionInput): ReviewArea {
  if (inp.perTenThousand == null || !inp.nationalPer)
    return { key: "competition", label: "경쟁 여유도", status: "nodata", signal: "병원 밀집 데이터 없음", metric: null };
  const ratio = inp.perTenThousand / inp.nationalPer;
  const opens = inp.openingsY1 ?? 0;
  const metric = `만명당 ${inp.perTenThousand} (전국 ${inp.nationalPer}) · 1년 개원 ${opens}`;
  if (ratio <= 0.8) return { key: "competition", label: "경쟁 여유도", status: "good", signal: "공급 여유 상권 — 수요 대비 경쟁 낮아 진입 기회", metric };
  if (ratio >= 1.2 || opens >= 20) return { key: "competition", label: "경쟁 여유도", status: "risk", signal: "경쟁 과밀·개원 활발 — 차별화 없인 매몰 위험", metric };
  return { key: "competition", label: "경쟁 여유도", status: "watch", signal: "평균 경쟁 — 검색 점유 선점이 관건", metric };
}

function areaBuyingPower(inp: AcquisitionInput): ReviewArea {
  if (inp.incomeIndex == null)
    return { key: "income", label: "구매력", status: "nodata", signal: "소득 데이터 없음", metric: null };
  const metric = `개인소득 지수 ${inp.incomeIndex} (전국=100)`;
  if (inp.incomeIndex >= 103) return { key: "income", label: "구매력", status: "good", signal: "상위 구매력 — 비급여·프리미엄 시술 소구 유효", metric };
  if (inp.incomeIndex >= 97) return { key: "income", label: "구매력", status: "watch", signal: "중위 구매력 — 가성비·접근성 소구 병행", metric };
  return { key: "income", label: "구매력", status: "watch", signal: "구매력 낮음 — 급여·필수의료 중심 소구", metric };
}

function areaAccess(inp: AcquisitionInput): ReviewArea {
  if (inp.accessLevel == null)
    return { key: "access", label: "광역 접근성", status: "nodata", signal: "접근성 데이터 없음", metric: null };
  const metric = inp.accessLabel ?? `등급 ${inp.accessLevel}/3`;
  if (inp.accessLevel >= 2) return { key: "access", label: "광역 접근성", status: "good", signal: "역세권·전철 접근 — 광역 유입 타깃 확대 가능", metric };
  if (inp.accessLevel === 1) return { key: "access", label: "광역 접근성", status: "watch", signal: "광역 철도 접근 — 인근 상권 유입 소구", metric };
  return { key: "access", label: "광역 접근성", status: "watch", signal: "철도 접근 미약 — 지역 밀착·플레이스 중심", metric };
}

function areaMomentum(inp: AcquisitionInput): ReviewArea {
  if (inp.populationDelta == null)
    return { key: "momentum", label: "성장 모멘텀", status: "nodata", signal: "인구 증감 데이터 없음", metric: null };
  const metric = `전월 ${inp.populationDelta >= 0 ? "▲" : "▼"}${fmt(Math.abs(inp.populationDelta))}`;
  if (inp.populationDelta > 0) return { key: "momentum", label: "성장 모멘텀", status: "good", signal: "인구 유입 상권 — 신규 전입 수요 선점 기회", metric };
  if (inp.populationDelta < 0) return { key: "momentum", label: "성장 모멘텀", status: "watch", signal: "정체·감소 상권 — 기존 수요 점유·리텐션 중심", metric };
  return { key: "momentum", label: "성장 모멘텀", status: "watch", signal: "인구 보합", metric };
}

function areaSearchOpp(inp: AcquisitionInput): ReviewArea {
  if (inp.demandRows <= 0)
    return { key: "search", label: "검색 수요 구조", status: "nodata", signal: "진료과 미선택 — 수요 상병 구조 없음", metric: null };
  return { key: "search", label: "검색 수요 구조", status: "good", signal: `${inp.specialty ?? "진료과"} 실수요 상병 구조 확보 — 여정·키워드 설계 근거`, metric: `주상병 ${inp.demandRows}종` };
}

// 수주 대응 방향(진입 전략) — 강점은 활용, 약점은 방어.
function deriveAcquisitionActions(areas: ReviewArea[], inp: AcquisitionInput): ReviewAction[] {
  const out: ReviewAction[] = [];
  const st = (k: string) => areas.find((a) => a.key === k)?.status;
  if (st("competition") === "risk")
    out.push({ priority: 1, area: "경쟁 여유도", title: "차별화·틈새 진료 포지셔닝", why: "과밀 상권에서 일반 소구는 경쟁에 매몰된다", how: "상권 수요 상위 진료 중 경쟁 공백 시술을 대표 메시지로 선점" });
  else if (st("competition") === "good")
    out.push({ priority: 1, area: "경쟁 여유도", title: "공급 공백 선점 소구", why: "수요 대비 경쟁이 낮아 초기 점유가 빠르다", how: "대표 진료 키워드에서 플레이스·검색 상위를 조기 확보" });
  if (inp.femaleRatio != null && inp.femaleRatio >= 51)
    out.push({ priority: 2, area: "타깃", title: "여성 타깃 소구 강화", why: `여성 비중 ${inp.femaleRatio}%로 여초 상권`, how: "피부·다이어트·산부인과 등 여성 수요 진료의 콘텐츠·채널 비중 상향" });
  if (st("income") === "good")
    out.push({ priority: 2, area: "구매력", title: "프리미엄·비급여 소구", why: "상위 구매력 상권은 고단가 시술 전환이 높다", how: "비급여 시술 랜딩·상담 동선 강화, 가격 대신 가치 메시지" });
  if (st("access") === "good")
    out.push({ priority: 2, area: "접근성", title: "광역 유입 타깃 확대", why: "역세권·전철 접근으로 인근 상권 유입이 가능", how: "지역명+진료 키워드를 인접 동·역세권까지 확장 타깃팅" });
  if (st("momentum") === "good")
    out.push({ priority: 2, area: "성장", title: "신규 전입 인구 선점", why: "유입 상권은 병원 미확정 신규 수요가 많다", how: "이사·전입 시즌 지역 검색·플레이스 노출 집중" });
  out.sort((a, b) => a.priority - b.priority);
  return out.slice(0, 5);
}

/** 신규 수주 진단(상권 기회 → 진입 대응 방향). */
export function buildAcquisitionReview(inp: AcquisitionInput): ConsultingReview {
  const areas: ReviewArea[] = [
    areaDemand(inp),
    areaCompetition(inp),
    areaBuyingPower(inp),
    areaAccess(inp),
    areaMomentum(inp),
    areaSearchOpp(inp)
  ];
  const scored = areas.filter((a) => a.status !== "nodata");
  const overallScore = inp.scoreOverall ?? (scored.length ? Math.round(scored.reduce((s, a) => s + SCORE[a.status], 0) / scored.length) : 0);
  const tier = overallScore >= 75 ? "높음" : overallScore >= 50 ? "보통" : overallScore > 0 ? "낮음" : "미상";
  const stage = `수주 매력도: ${tier}`;
  const goodCount = areas.filter((a) => a.status === "good").length;
  const riskCount = areas.filter((a) => a.status === "risk").length;
  const stageNote =
    tier === "높음"
      ? "상권 기회가 크다 — 강점 활용 소구로 수주 제안을 공격적으로 구성."
      : tier === "낮음"
        ? "상권 여건이 제한적 — 좁은 타깃·차별화로 수주 논리를 세워야 함."
        : "기회와 리스크가 혼재 — 강점 소구 + 약점 방어를 함께 제안.";
  const actions = deriveAcquisitionActions(areas, inp);
  const dataGaps = areas.filter((a) => a.status === "nodata").map((a) => a.label);
  const headline =
    dataGaps.length >= 4
      ? `${inp.hospitalName} — 상권 신호가 부족합니다. 지역·진료과를 정확히 입력하면 수주 진단이 정밀해집니다.`
      : riskCount >= 1 && goodCount >= 2
        ? `${inp.hospitalName} — 기회(${goodCount})와 경쟁 리스크가 공존. 차별화 소구로 수주 논리 구성.`
        : goodCount >= 3
          ? `${inp.hospitalName} — 상권 기회가 우호적. 강점 소구로 수주 제안 공격적 구성 가능.`
          : `${inp.hospitalName} — ${stage}. 진입 대응 ${actions.length}건을 제안합니다.`;
  return { hospitalName: inp.hospitalName, headline, stage, stageNote, overallScore, areas, actions, dataGaps };
}

const SIGNAL_MARK: Record<Signal, string> = { good: "🟢", watch: "🟡", risk: "🔴", nodata: "⚪" };

/** 상담용 브리프(마크다운) — 복사·문서화용. title 로 수주/진행 구분. */
export function consultingReviewMarkdown(
  r: ConsultingReview,
  meta: { region: string; departments: string[]; date: string; title?: string }
): string {
  const L: string[] = [];
  L.push(`# ${meta.title ?? "마케팅 상담 진단"} — ${r.hospitalName}`);
  L.push("");
  L.push(`- **지역/진료** ${meta.region}${meta.departments.length ? ` · ${meta.departments.join("·")}` : ""} · **기준일** ${meta.date}`);
  L.push(`- **종합** ${r.stage} · ${r.overallScore}/100`);
  L.push(`- ${r.headline}`);
  L.push("");
  L.push(`## 영역별 진단`);
  L.push(`| 영역 | 상태 | 진단 | 지표 |`);
  L.push(`|---|:--:|---|---|`);
  for (const a of r.areas) L.push(`| ${a.label} | ${SIGNAL_MARK[a.status]} | ${a.signal} | ${a.metric ?? "—"} |`);
  L.push("");
  if (r.actions.length) {
    L.push(`## 대응 방향 (우선순위)`);
    r.actions.forEach((a, i) => {
      L.push(`${i + 1}. **${a.title}** _(${a.area}${a.priority === 1 ? " · 시급" : ""})_`);
      L.push(`   - 이유: ${a.why}`);
      L.push(`   - 실행: ${a.how}`);
    });
    L.push("");
  }
  if (r.dataGaps.length) {
    L.push(`## 데이터 공백(진단 제한)`);
    L.push(`- ${r.dataGaps.join(" · ")} — 이 영역은 실측 신호가 없어 진단에서 제외됨. 연결 시 정밀도 상승.`);
    L.push("");
  }
  L.push(`> 본 진단은 실측 신호 기반 규칙 합성입니다. 수치는 목표·해석이며 성과 보장이 아닙니다. 의료광고법 준수.`);
  return L.join("\n");
}
