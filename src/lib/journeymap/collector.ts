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
  const own = ownContext(mainKeyword, profile);

  const addKeywordNode = (kw: string, parentId: string | null, depth: number, source: JNode["source"]): JNode | null => {
    const key = normKey(kw);
    if (seen.has(key)) {
      hitCount.set(key, (hitCount.get(key) || 0) + 1);
      return null;
    }
    if (nodes.length - 5 >= options.maxNodes) return null;
    seen.add(key);
    hitCount.set(key, 1);
    const { stage, confidence } = classifyStage(kw, profile, mainKeyword);
    const risk = scanRisk(kw);
    const node: JNode = {
      id: uid(), parentId: parentId ?? branchByStage[stage].id, keyword: kw, kind: "keyword", depth,
      stage, stageConfidence: confidence, stageOverridden: false, source,
      score: 0, riskLevel: risk.level, riskReasons: risk.reasons,
      isBrand: isBrandKeyword(kw, profile), collapsed: false,
    };
    nodes.push(node);
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
