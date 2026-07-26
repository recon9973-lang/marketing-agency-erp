"use client";

import { classifyStage, isBrandKeyword } from "./classify";
import { scanRisk } from "./risk";
import { uid } from "./store";
import { CollectOptions, HospitalProfile, JNode, Stage, STAGES, STAGE_META } from "./types";

export interface CollectProgress {
  phase: "seeding" | "collecting" | "enriching" | "classifying" | "scoring" | "done";
  percent: number;
  message: string;
  naverCount: number;
  googleCount: number;
  kinCount: number;
  failedSources: string[];
}

async function fetchSuggest(q: string, source: "naver" | "google"): Promise<string[]> {
  try {
    const res = await fetch(`/api/journeymap/suggest?q=${encodeURIComponent(q)}&source=${source}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.items || [];
  } catch {
    throw new Error(source);
  }
}

async function fetchKin(q: string): Promise<{ title: string; link: string }[]> {
  try {
    const res = await fetch(`/api/journeymap/kin?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.unconfigured || data.error) throw new Error("kin");
    return data.items || [];
  } catch {
    throw new Error("kin");
  }
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

// 타 지역 키워드 제외용 주요 지역·역세권 토큰 (프로필 지역/브랜드/메인 키워드에 포함된 토큰은 허용)
const REGION_TOKENS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "제주", "서귀포",
  "수원", "성남", "고양", "용인", "부천", "안산", "안양", "남양주", "화성", "평택",
  "의정부", "시흥", "파주", "김포", "광명", "군포", "하남", "구리", "일산", "분당",
  "판교", "평촌", "산본", "동탄", "광교", "정자", "서현", "야탑", "위례", "미사",
  "춘천", "원주", "강릉", "속초", "청주", "충주", "천안", "아산", "세종시",
  "전주", "군산", "익산", "목포", "여수", "순천", "포항", "경주", "구미", "안동",
  "창원", "진주", "김해", "양산", "거제", "마산",
  "강남", "서초", "송파", "강동", "강서", "양천", "영등포", "구로", "금천", "관악",
  "동작", "마포", "서대문", "은평", "종로", "용산", "성동", "광진", "동대문", "중랑",
  "성북", "강북", "도봉", "노원",
  "압구정", "신사역", "청담", "논현", "역삼", "삼성동", "대치", "선릉", "교대", "사당",
  "신촌", "홍대", "합정", "왕십리", "건대", "잠실", "천호", "목동", "여의도",
  "해운대", "서면", "광안리", "센텀", "수영", "연산", "동래", "사상", "명지",
];

// 프로필 기준 "허용된" 텍스트 — 여기에 등장하는 지역 토큰은 자기 지역이므로 허용
function ownContext(mainKeyword: string, profile: HospitalProfile): string {
  return normKey(
    [mainKeyword, profile.name, profile.regionSigungu, profile.regionDong, ...profile.competitors].filter(Boolean).join("|")
  );
}

// 타 지역 키워드인지 검사 (예: 춘천 병원 프로젝트에 "해운대", "부천" 키워드 유입 차단)
function hasForeignRegion(kw: string, own: string): boolean {
  const k = normKey(kw);
  for (const t of REGION_TOKENS) {
    const tn = normKey(t);
    if (k.includes(tn) && !own.includes(tn)) return true;
  }
  return false;
}


// 일반 의료·검색 표현 사전 — 잔여 토큰 검사에서 "정상 단어"로 취급
const GENERIC_TERMS = [
  "정형외과", "피부과", "치과", "성형외과", "내과", "이비인후과", "안과", "한의원", "산부인과", "비뇨의학과",
  "재활의학과", "신경외과", "신경과", "마취통증의학과", "통증의학과", "가정의학과", "정신건강의학과", "소아과", "외과",
  "병원", "의원", "클리닉", "센터", "의료원", "보건소", "요양병원", "재활병원",
  "잘하는곳", "잘하는", "잘하", "유명한", "유명", "추천", "후기", "가격", "비용", "가성비", "저렴", "싼곳",
  "예약", "근처", "위치", "어디", "베스트", "순위", "리스트", "모음",
  "야간", "야간진료", "일요일", "토요일", "주말", "평일", "새벽", "공휴일", "24시", "응급", "당일", "점심시간",
  "진료", "진료시간", "전문", "전문의", "수술", "비수술", "시술", "치료", "검사", "주사", "약",
  "도수치료", "도수", "물리치료", "재활", "추나", "충격파", "체외충격파", "프롤로", "신경차단술",
  "디스크", "목디스크", "허리디스크", "협착증", "측만증", "거북목", "일자목", "오십견", "회전근개",
  "족저근막염", "염좌", "골절", "탈구", "인대", "연골", "관절", "관절염", "십자인대", "반월상",
  "통증", "어깨", "허리", "목", "무릎", "발목", "손목", "팔꿈치", "손가락", "발가락", "고관절", "척추", "골반",
  "엑스레이", "초음파", "도수재활", "체형교정", "교정", "자세교정",
  "임플란트", "틀니", "교정", "미백", "충치", "신경치료", "발치", "사랑니", "스케일링",
  "보톡스", "필러", "리프팅", "실리프팅", "레이저", "제모", "여드름", "기미", "점", "흉터", "모공",
];

// 잔여 토큰 추출 — 내 지역·프로필·일반 용어를 모두 제거한 뒤 정체불명 한글 토큰(≥2자)이 남으면
// 그 토큰을 반환. 미등재 타지역(동 단위)·타 병원 브랜드 후보로 보고 아래 실측 검증에 넘긴다.
function unknownResidualToken(kw: string, mainKeyword: string, profile: HospitalProfile): string | null {
  let t = normKey(kw);
  const strips = [
    mainKeyword, profile.name, profile.regionSigungu, profile.regionDong,
    ...profile.departments, ...profile.mainTreatments, ...profile.competitors, ...GENERIC_TERMS,
  ]
    .filter(Boolean)
    .map(normKey)
    .filter((x) => x.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const x of strips) t = t.split(x).join("");
  t = t.replace(/[0-9a-z\s\-·.,!?~()%&+]/g, "");
  return t.length >= 2 ? t : null;
}

// 지명 형태 토큰인지 (동·읍·면·리·가·구·군·시로 끝나면 지명 가능성 높음)
function looksLikePlace(token: string): boolean {
  return /[가-힣](동|읍|면|리|가|구|군|시)$/.test(token);
}

// ── 실측 검증기 (원천 차단의 핵심) ────────────────────────────────
// 정체불명 토큰을 네이버 지역검색으로 조회해 검색 결과 주소의 과반이 "자기 도시"면 통과,
// 아니면 차단. 사전에 없는 전국의 동·읍·면·상호도 실측으로 판별된다.
// 예) 포항 프로젝트: "양덕동" → 주소 과반 포항 → 유지 / "태전동" → 주소 과반 대구 → 차단.
const GENERIC_GU = new Set(["동구", "서구", "남구", "북구", "중구"]); // 여러 도시에 공통 → 대조 기준에서 제외
function makeLocalVerifier(profile: HospitalProfile) {
  const cityTokens = new Set<string>();
  for (const part of `${profile.regionSigungu || ""} ${profile.regionDong || ""}`.split(/\s+/)) {
    const p = part.trim();
    if (p.length < 2 || GENERIC_GU.has(p) || /(동|읍|면|리)$/.test(p)) continue; // 주소 대조는 시·군·특징적 구 단위로만
    cityTokens.add(p);
    const stripped = p.replace(/(특별시|광역시|특별자치시|특별자치도|시|군|구)$/, "");
    if (stripped.length >= 2) cityTokens.add(stripped);
  }
  const cache = new Map<string, boolean>();
  return async (token: string): Promise<boolean> => {
    if (cityTokens.size === 0) return false; // 지역 미입력 → 검증 불가 → 안전하게 차단
    const hit = cache.get(token);
    if (hit !== undefined) return hit;
    let ok = false;
    try {
      const res = await fetch(`/api/journeymap/local?q=${encodeURIComponent(token)}`);
      const data = await res.json();
      const items: { address?: string }[] = data.items || [];
      if (items.length > 0) {
        const ownHits = items.filter((it) =>
          Array.from(cityTokens).some((c) => String(it.address || "").includes(c))
        ).length;
        ok = ownHits >= Math.ceil(items.length / 2); // 과반이 자기 도시 주소여야 통과
      }
    } catch {
      ok = false; // 조회 실패 시 오염보다 누락을 택한다 (원천 차단 우선)
    }
    cache.set(token, ok);
    return ok;
  };
}

function isRelevant(kw: string, mainKeyword: string, profile: HospitalProfile): boolean {
  const k = normKey(kw);
  const anchors = [mainKeyword, profile.name, ...profile.mainTreatments, ...profile.departments, ...profile.competitors]
    .filter(Boolean)
    .map(normKey);
  const head = normKey(mainKeyword).slice(0, 2);
  return anchors.some((a) => a && k.includes(a)) || (head.length >= 2 && k.includes(head));
}

// 지식iN 질문은 느슨하게 검색되므로 더 엄격한 검사:
// ① 진료과·주력시술·메인키워드·병원명 중 하나 포함(주제 연결)
// ② 자기 지역·역세권·병원명 중 하나 포함(지역 연결) — 전국 단위 질문("정형외과 추천이요") 차단
function kinRelevant(kw: string, mainKeyword: string, profile: HospitalProfile): boolean {
  const k = normKey(kw);
  const topicAnchors = [mainKeyword, profile.name, ...profile.departments, ...profile.mainTreatments]
    .filter(Boolean)
    .map(normKey);
  if (!topicAnchors.some((a) => a.length >= 2 && k.includes(a))) return false;
  const localAnchors = [profile.regionSigungu, profile.regionDong, profile.name]
    .filter(Boolean)
    .map(normKey);
  // 지역을 입력하지 않은 프로필이면 지역 검사는 생략
  if (localAnchors.length === 0) return true;
  return localAnchors.some((a) => a.length >= 2 && k.includes(a));
}


// ── 소급 정리 스캐너 — 이미 저장된 맵에 수집 필터(3중 방어)를 사후 적용한다.
// 옛 버전으로 수집돼 타지역 키워드가 남아 있는 맵을 재수집 없이 정리하기 위한 용도.
// kin(문장형)·user(수동 입력) 노드는 잔여 토큰 검사 대상에서 제외한다.
export async function findForeignNodeIds(
  nodes: JNode[],
  mainKeyword: string,
  profile: HospitalProfile
): Promise<string[]> {
  const own = ownContext(mainKeyword, profile);
  const verifyLocal = makeLocalVerifier(profile);
  const out: string[] = [];
  for (const n of nodes) {
    if (n.kind !== "keyword" || n.source === "user") continue;
    if (hasForeignRegion(n.keyword, own)) {
      out.push(n.id);
      continue;
    }
    if (n.source === "naver_kin") continue;
    const residual = unknownResidualToken(n.keyword, mainKeyword, profile);
    if (!residual) continue;
    // 연관키워드(전국 단위 유입원)는 모든 잔여 토큰, 그 외는 지명 형태만 검증
    if (n.source !== "naver_rel" && !looksLikePlace(residual)) continue;
    if (!(await verifyLocal(residual))) out.push(n.id);
  }
  return out;
}

export async function runCollection(
  mainKeyword: string,
  profile: HospitalProfile,
  seeds: string[],
  options: CollectOptions,
  onProgress: (p: CollectProgress) => void
): Promise<{ nodes: JNode[]; failedSources: string[] }> {
  const failedSources = new Set<string>();
  let naverCount = 0;
  let googleCount = 0;
  let kinCount = 0;

  const report = (phase: CollectProgress["phase"], percent: number, message: string) =>
    onProgress({ phase, percent, message, naverCount, googleCount, kinCount, failedSources: Array.from(failedSources) });

  report("seeding", 4, `시드 확장 완료 (${seeds.length}개)`);

  // ── 트리 뼈대
  const center: JNode = {
    id: uid(), parentId: null, keyword: mainKeyword, kind: "center", depth: 0,
    stage: null, stageConfidence: 1, stageOverridden: false, source: "user",
    score: 100, riskLevel: "none", riskReasons: [], isBrand: false, collapsed: false,
  };
  const branchByStage = {} as Record<Stage, JNode>;
  const branches = STAGES.map((stage) => {
    const b: JNode = {
      id: uid(), parentId: center.id, keyword: STAGE_META[stage].label, kind: "branch", depth: 1,
      stage, stageConfidence: 1, stageOverridden: false, source: "user",
      score: 0, riskLevel: "none", riskReasons: [], isBrand: false, collapsed: false,
    };
    branchByStage[stage] = b;
    return b;
  });

  const nodes: JNode[] = [center, ...branches];
  const seen = new Set<string>([normKey(mainKeyword)]);
  const hitCount = new Map<string, number>();
  const nodeByKey = new Map<string, JNode>();
  const own = ownContext(mainKeyword, profile);
  const verifyLocal = makeLocalVerifier(profile); // 정체불명 토큰 실측 검증(도시 대조·캐시)

  const addKeywordNode = (kw: string, parentId: string | null, depth: number, source: JNode["source"]): JNode | null => {
    const key = normKey(kw);
    if (seen.has(key)) {
      hitCount.set(key, (hitCount.get(key) || 0) + 1);
      // 다중 소스 실측 기록: 같은 키워드를 다른 소스도 발견하면 교집합 데이터로 남김
      const existing = nodeByKey.get(key);
      if (existing) {
        if (!existing.sourcesAll) existing.sourcesAll = [existing.source];
        if (!existing.sourcesAll.includes(source)) existing.sourcesAll.push(source);
      }
      return null;
    }
    if (nodes.length - 5 >= options.maxNodes) return null;
    seen.add(key);
    hitCount.set(key, 1);
    const { stage, confidence } = classifyStage(kw, profile, mainKeyword);
    // sourcesAll은 노드 생성 후 아래에서 세팅
    const risk = scanRisk(kw);
    const node: JNode = {
      id: uid(), parentId: parentId ?? branchByStage[stage].id, keyword: kw, kind: "keyword", depth,
      stage, stageConfidence: confidence, stageOverridden: false, source,
      score: 0, riskLevel: risk.level, riskReasons: risk.reasons,
      isBrand: isBrandKeyword(kw, profile), collapsed: false,
      sourcesAll: [source],
    };
    nodes.push(node);
    nodeByKey.set(key, node);
    return node;
  };

  // ── 시드 → depth 2
  const queue: { node: JNode; level: number }[] = [];
  for (const s of seeds) {
    const n = addKeywordNode(s, null, 2, "seed");
    if (n) queue.push({ node: n, level: 1 });
  }

  // ── 초성 확장 (키워드마스터·블랙키위 방식): "메인키워드 + ㄱ~ㅎ"으로 자동완성을 훑어
  // 일반 자동완성에 안 나오는 롱테일(일요일·입원·야간진료 등)을 발굴
  if (options.sources.includes("naver") && !failedSources.has("naver")) {
    const INITIALS = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
    report("collecting", 6, "초성 확장 수집 중… (메인키워드 + ㄱ~ㅎ)");
    for (let i = 0; i < INITIALS.length; i += 4) {
      if (nodes.length - 5 >= options.maxNodes) break;
      const batch = INITIALS.slice(i, i + 4);
      const results = await Promise.allSettled(batch.map((c) => fetchSuggest(`${mainKeyword} ${c}`, "naver")));
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const kw of r.value) {
          if (!isRelevant(kw, mainKeyword, profile)) continue;
          if (hasForeignRegion(kw, own)) continue;
          const residual = unknownResidualToken(kw, mainKeyword, profile);
          if (residual && !(await verifyLocal(residual))) continue; // 실측: 자기 도시 소속 아님 → 원천 차단
          naverCount++;
          const child = addKeywordNode(kw, null, 2, "naver_ac");
          if (child && queue.length < 60) queue.push({ node: child, level: 2 });
        }
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // ── BFS 수집: 자동완성(재귀) + 지식iN(시드 레벨만)
  const maxLevel = options.depth;
  const totalEstimate = Math.min(options.maxNodes, seeds.length * 12);

  while (queue.length > 0 && nodes.length - 5 < options.maxNodes) {
    const { node, level } = queue.shift()!;
    if (level > maxLevel) continue;

    const pct = Math.min(70, 8 + Math.round(((nodes.length - 5) / totalEstimate) * 62));
    report("collecting", pct, `수집 중… "${node.keyword}" (심도 ${level}/${maxLevel}, 노드 ${nodes.length - 5}개)`);

    const tasks: Promise<{ source: "naver" | "google" | "kin"; items: string[] }>[] = [];
    if (options.sources.includes("naver") && !failedSources.has("naver")) {
      tasks.push(fetchSuggest(node.keyword, "naver").then((items) => ({ source: "naver" as const, items })));
    }
    if (options.sources.includes("google") && !failedSources.has("google")) {
      tasks.push(fetchSuggest(node.keyword, "google").then((items) => ({ source: "google" as const, items })));
    }
    // 지식iN은 시드 레벨(level 1)에서만 수집 — 실제 환자 질문 문장.
    // 검색어에 지역이 없으면 지역을 붙여 검색해 전국 단위 질문 유입을 줄임
    let kinItems: { title: string; link: string }[] = [];
    if (options.sources.includes("kin") && level === 1 && !failedSources.has("kin")) {
      const region = normKey(profile.regionSigungu || "");
      const kinQuery =
        region && !normKey(node.keyword).includes(region) ? `${profile.regionSigungu} ${node.keyword}` : node.keyword;
      try {
        kinItems = await fetchKin(kinQuery);
      } catch {
        failedSources.add("kin");
      }
    }

    const results = await Promise.allSettled(tasks);
    for (const r of results) {
      if (r.status === "rejected") {
        const src = String(r.reason?.message || r.reason);
        if (src.includes("naver")) failedSources.add("naver");
        if (src.includes("google")) failedSources.add("google");
        continue;
      }
      const { source, items } = r.value;
      for (const kw of items) {
        // 관련성 필터: 앵커 검사 + 타 지역 키워드 제외
        if (!isRelevant(kw, mainKeyword, profile)) continue;
        if (hasForeignRegion(kw, own)) continue;
        {
          // 자동완성 결과도 지명 형태(○○동·○○구 등) 잔여 토큰은 실측 검증해 타지역 차단
          const residual = unknownResidualToken(kw, mainKeyword, profile);
          if (residual && looksLikePlace(residual) && !(await verifyLocal(residual))) continue;
        }
        if (source === "naver") naverCount++;
        else googleCount++;
        const child = addKeywordNode(kw, node.id, node.depth + 1, source === "naver" ? "naver_ac" : "google_ac");
        if (child && level < maxLevel && queue.length < 60) {
          queue.push({ node: child, level: level + 1 });
        }
      }
    }

    // 지식iN 결과: 주제 앵커 + 지역 앵커(엄격) + 타 지역 제외, 원본 질문 링크 저장
    for (const item of kinItems) {
      if (!kinRelevant(item.title, mainKeyword, profile)) continue;
      if (hasForeignRegion(item.title, own)) continue;
      kinCount++;
      const child = addKeywordNode(item.title, node.id, node.depth + 1, "naver_kin");
      if (child) child.sourceUrl = item.link || null;
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  // ── 연관키워드 확장: 검색광고 API가 반환하는 연관키워드를 검색량과 함께 추가
  // (예: "춘천 정형외과" → 춘천 정형외과 추천/야간진료/일요일, 동네별·브랜드별 변형)
  report("collecting", 70, "검색광고 연관키워드 확장 중…");
  try {
    const hintSeeds = Array.from(new Set([mainKeyword, ...seeds])).slice(0, 5);
    const res = await fetch("/api/journeymap/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: hintSeeds, includeRelated: true }),
    });
    const data = await res.json();
    if (!data.unconfigured) {
      // 힌트로 보낸 메인 키워드·시드의 검색량도 함께 반영 (버리지 않음)
      // — 특히 메인 키워드(중심 노드)는 검색량이 가장 큰 키워드인데 누락되어 있었음
      for (const [kw, m] of Object.entries<{ volumePc: number | null; volumeMo: number | null; competition: string | null }>(
        data.results || {}
      )) {
        const target =
          normKey(kw) === normKey(mainKeyword)
            ? center
            : nodes.find((n) => n.kind === "keyword" && normKey(n.keyword) === normKey(kw));
        if (target) {
          target.volumePc = m.volumePc;
          target.volumeMo = m.volumeMo;
          target.competition = m.competition;
        }
      }
      let added = 0;
      for (const rel of data.related || []) {
        if (nodes.length - 5 >= options.maxNodes || added >= 50) break;
        if (!isRelevant(rel.keyword, mainKeyword, profile)) continue;
        if (hasForeignRegion(rel.keyword, own)) continue;
        const residual = unknownResidualToken(rel.keyword, mainKeyword, profile);
        if (residual && !(await verifyLocal(residual))) continue; // 실측: 자기 도시 소속 아님 → 원천 차단
        const child = addKeywordNode(rel.keyword, null, 2, "naver_rel");
        if (child) {
          child.volumePc = rel.volumePc;
          child.volumeMo = rel.volumeMo;
          child.competition = rel.competition;
          added++;
        }
      }
    }
  } catch {
    /* 연관키워드 확장 실패는 무시 */
  }

  const kwNodes = nodes.filter((n) => n.kind === "keyword");

  // ── 브랜드 확인: 네이버 플레이스에서 병원명 대조 — 유사 명칭 타 병원이 있으면 브랜드 노드에 경고
  // (예: "그랜드연합의원"(정형외과) 검색 시 "그랜드연합내과의원"(내과) 후기가 섞이는 문제)
  if (profile.name) {
    report("enriching", 72, "병원명 실제 대조 중… (네이버 플레이스)");
    try {
      const q = profile.regionSigungu ? `${profile.regionSigungu} ${profile.name}` : profile.name;
      const res = await fetch(`/api/journeymap/local?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const items: { title: string; category: string; address: string }[] = data.items || [];
      const nameNorm = normKey(profile.name);
      // 병원명 핵심부(의원/병원/치과/한의원 등 접미 제거)
      const core = nameNorm.replace(/(치과의원|한의원|의원|병원|클리닉|치과)$/g, "");
      const similars = items.filter((it) => {
        const t = normKey(it.title);
        return t !== nameNorm && core.length >= 2 && t.includes(core);
      });
      if (similars.length > 0) {
        const list = similars.map((s) => `${s.title}(${s.category.split(">").pop() || ""})`).join(", ");
        for (const n of kwNodes) {
          if (!n.isBrand) continue;
          n.riskReasons = [
            {
              ruleId: "brand-ambiguity",
              matched: profile.name,
              law: "브랜드 혼동 주의 (의료법 아님)",
              description: `유사 명칭 병원이 존재합니다: ${list}. 이 키워드의 검색 결과·후기에 타 병원 콘텐츠가 섞일 수 있습니다.`,
              suggestion: "콘텐츠·광고에는 정확한 전체 병원명과 지역·진료과를 함께 표기해 혼동을 방지하세요.",
            },
            ...n.riskReasons,
          ];
          if (n.riskLevel === "none") n.riskLevel = "yellow";
        }
      }
    } catch {
      /* 플레이스 확인 실패는 무시 */
    }
  }

  // ── 지표 결합: 월간 검색량·경쟁도·CPC (네이버 검색광고 API, 5개씩 배치)
  report("enriching", 74, "월간 검색량·CPC 조회 중… (네이버 검색광고 API)");
  let volumeAvailable = false;
  {
    // 상위 우선: 시드·얕은 심도 먼저, 최대 150개(30배치)
    // 지식iN 질문 문장은 검색광고 API에 데이터가 없어 제외
    const targets = [...kwNodes]
      .filter((n) => n.source !== "naver_kin" && n.volumePc == null && n.volumeMo == null)
      .sort((a, b) => a.depth - b.depth)
      .slice(0, 150);
    const byKey = new Map(targets.map((n) => [n.keyword, n]));
    const batches: string[][] = [];
    const keys = Array.from(byKey.keys());
    for (let i = 0; i < keys.length; i += 5) batches.push(keys.slice(i, i + 5));

    let unconfigured = false;
    for (let bi = 0; bi < batches.length && !unconfigured; bi++) {
      report("enriching", 74 + Math.round((bi / Math.max(batches.length, 1)) * 10), `검색량 조회 ${bi + 1}/${batches.length} 배치…`);
      try {
        const res = await fetch("/api/journeymap/volume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: batches[bi] }),
        });
        const data = await res.json();
        if (data.unconfigured) {
          unconfigured = true;
          break;
        }
        for (const [kw, m] of Object.entries<{ volumePc: number | null; volumeMo: number | null; competition: string | null; cpc: number | null }>(data.results || {})) {
          const n = byKey.get(kw);
          if (!n) continue;
          n.volumePc = m.volumePc;
          n.volumeMo = m.volumeMo;
          n.competition = m.competition;
          n.cpc = m.cpc;
          if (m.volumePc != null || m.volumeMo != null) volumeAvailable = true;
        }
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    if (unconfigured) failedSources.add("volume(키 미설정)");
  }

  // ── AI 분류 보정: 저신뢰(confidence < 0.65) 노드만 배치 호출 (§9.3 2차)
  if (options.useAi) {
    report("classifying", 86, "AI 여정 분류 보정 중… (저신뢰 키워드)");
    try {
      const lowConf = kwNodes.filter((n) => n.stageConfidence < 0.65 && !n.stageOverridden).slice(0, 40);
      if (lowConf.length > 0) {
        const res = await fetch("/api/journeymap/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "classify",
            mainKeyword,
            profile,
            keywords: lowConf.map((n) => ({ id: n.id, keyword: n.keyword })),
          }),
        });
        const data = await res.json();
        if (data.unconfigured) {
          failedSources.add("ai(키 미설정)");
        } else {
          const byId = new Map(kwNodes.map((n) => [n.id, n]));
          for (const [id, stage] of Object.entries<string>(data.corrections || {})) {
            const n = byId.get(id);
            if (n && n.stage !== stage) {
              n.stage = stage as Stage;
              n.stageConfidence = 0.85;
              n.aiCorrected = true;
              // 브랜치 직속 노드면 새 단계 브랜치로 이동
              const parent = nodes.find((x) => x.id === n.parentId);
              if (parent?.kind === "branch") n.parentId = branchByStage[stage as Stage].id;
            }
          }
        }
      }
    } catch {
      failedSources.add("ai(호출 실패)");
    }
  }

  // ── S_intent 스코어링 (§9.2): 검색량 있으면 실공식, 없으면 등장빈도 프록시
  report("scoring", 94, "의도 가치 점수(S_intent) 산출 중…");
  const maxCpc = Math.max(...kwNodes.map((n) => n.cpc ?? 0), 1);
  const raw: number[] = kwNodes.map((n) => {
    const depthW = n.depth <= 2 ? 1.0 : n.depth === 3 ? 1.2 : 1.5;
    const riskPenalty = n.riskLevel === "red" ? 1.0 : n.riskLevel === "yellow" ? 0.5 : 0;
    if (volumeAvailable && (n.volumePc != null || n.volumeMo != null)) {
      const v = (n.volumePc ?? 0) + (n.volumeMo ?? 0);
      return 1.0 * Math.log(v + 1) + 0.8 * depthW + 0.6 * ((n.cpc ?? 0) / maxCpc) - 1.2 * riskPenalty;
    }
    const hits = hitCount.get(normKey(n.keyword)) || 1;
    return 1.0 * Math.log(hits + 1) + 0.8 * depthW - 1.2 * riskPenalty;
  });
  const min = Math.min(...raw, 0);
  const max = Math.max(...raw, 1);
  kwNodes.forEach((n, i) => {
    n.score = Math.round(((raw[i] - min) / (max - min || 1)) * 100);
  });

  report("done", 100, `완료 — 노드 ${nodes.length - 5}개 생성`);
  return { nodes, failedSources: Array.from(failedSources) };
}
