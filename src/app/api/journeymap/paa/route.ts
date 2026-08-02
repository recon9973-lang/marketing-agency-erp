import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { naverOpenApiCreds, naverOpenApiConfigured } from "@/server/integrations/naver-credentials";
import { diffTrees, PaaTree } from "@/lib/journeymap/paa";
import { normalizeQuery, parseRegion } from "@/lib/journeymap/region";
import { requireStaff } from "../guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// PAA(환자 질문) 분석 — 지식iN 수집 → Claude 구조화 → 영구 스냅샷 (journeymap 단독판 이식)

const MODEL = "claude-opus-5";

const STRUCTURE_SCHEMA = {
  type: "object",
  properties: {
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          stage: {
            type: "string",
            enum: ["exploration", "comparison", "decision", "retention"],
          },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                isLocal: { type: "boolean" },
                source: { type: "string", enum: ["naver", "google"] },
              },
              required: ["text", "isLocal", "source"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "stage", "questions"],
        additionalProperties: false,
      },
    },
  },
  required: ["categories"],
  additionalProperties: false,
} as const;

function stripHtml(s: string): string {
  return s
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

async function fetchNaverKin(query: string): Promise<string[]> {
  const creds = naverOpenApiCreds();
  if (!creds) return [];
  const url = `https://openapi.naver.com/v1/search/kin.json?query=${encodeURIComponent(query)}&display=100&sort=sim`;
  const res = await fetch(url, {
    headers: { "X-Naver-Client-Id": creds.id, "X-Naver-Client-Secret": creds.secret },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`naver kin ${res.status}`);
  const data = (await res.json()) as { items?: { title?: string }[] };
  return (data.items || [])
    .map((item) => stripHtml(item.title || ""))
    .filter((t) => t.length >= 5);
}

// 구글 PAA(People Also Ask) — SERPAPI_KEY 가 있을 때만 작동, 없으면 조용히 건너뜀
async function fetchGooglePaa(query: string): Promise<string[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return [];
  const url = `https://serpapi.com/search?engine=google&q=${encodeURIComponent(query)}&hl=ko&gl=kr&api_key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`serpapi ${res.status}`);
  const data = (await res.json()) as { related_questions?: { question?: string }[] };
  return (data.related_questions || [])
    .map((item) => (item.question || "").trim())
    .filter((q) => q.length >= 5);
}

interface RawQuestion {
  text: string;
  source: "naver" | "google";
}

// 두 소스 병렬 수집(출처 태그 유지) — 한쪽 실패는 다른 쪽으로 계속 진행.
// 구글 PAA 박스는 붙여쓰기에 민감하므로 지역+주제를 띄어쓰기 형태로 정규화해 조회한다
// (예: "마산한의원" → "마산 한의원" — SerpAPI 호출 수는 동일하게 1회).
async function collectQuestions(query: string): Promise<RawQuestion[]> {
  const { region, topic } = parseRegion(query);
  const googleQuery = region && topic ? `${region} ${topic}` : query;
  const [naver, google] = await Promise.allSettled([fetchNaverKin(query), fetchGooglePaa(googleQuery)]);
  const out: RawQuestion[] = [];
  if (naver.status === "fulfilled") for (const t of naver.value) out.push({ text: t, source: "naver" });
  if (google.status === "fulfilled") for (const t of google.value) out.push({ text: t, source: "google" });
  return out;
}

// 텍스트 기준 중복 제거 (공백 무시, 먼저 수집된 출처 유지)
function dedupeRaw(items: RawQuestion[]): RawQuestion[] {
  const seen = new Set<string>();
  const out: RawQuestion[] = [];
  for (const it of items) {
    const key = it.text.toLowerCase().replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}


// ── 전량 보존 정합: AI 가 빠뜨린 지식iN 질문을 원문 그대로 되살린다 (모델 무관 보장).
// 구글 질문은 무관 질문(국회의원류)이 섞여 AI 의 관련성 필터를 신뢰한다.
function tokenSet(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^가-힣a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length >= 2)
  );
}
function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => { if (b.has(t)) inter++; });
  return inter / Math.min(a.size, b.size);
}
function reconcileMissing(
  tree: PaaTree,
  raw: RawQuestion[],
  region: string | null,
  query: string
): void {
  // 키워드 자체 단어는 모든 질문에 들어가므로 변별 단어에서 제외
  const stop = tokenSet(query);
  const distinct = (text: string) => {
    const t = tokenSet(text);
    stop.forEach((x) => t.delete(x));
    return t;
  };
  const outTokens = tree.categories.flatMap((c) => c.questions.map((q) => distinct(q.text)));
  const regionTokens = region ? region.split(" ") : [];
  const missing = raw.filter((r) => {
    if (r.source !== "naver") return false;
    const rd = distinct(r.text);
    if (rd.size === 0) return false; // 키워드 단어뿐인 일반 질문은 커버된 것으로 간주
    return !outTokens.some((o) => tokenOverlap(rd, o) >= 0.5);
  });
  if (missing.length === 0) return;
  tree.categories.push({
    name: "기타 수집 질문",
    stage: "exploration",
    questions: missing.map((m) => ({
      text: m.text.trim(),
      isLocal: regionTokens.some((t) => m.text.includes(t)),
      source: m.source,
    })),
  });
}

async function structureWithAI(query: string, rawQuestions: RawQuestion[]): Promise<PaaTree> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: STRUCTURE_SCHEMA },
    },
    system:
      "당신은 병원 마케팅 데이터 아키텍트다. 환자들의 원시 질문 목록을 의미 기준 4~8개 대분류로 묶고, 각 대분류에 검색여정 단계를 배정하며, 질문은 원래 의미를 보존한 간결한 완성형 문장으로 정제한다. 규칙: 입력된 모든 질문을 빠짐없이 출력에 포함한다(메인 키워드와 무관한 질문만 제외). 문장까지 사실상 같은 완전 중복만 하나로 합치고, 유사해도 관점·상황이 다르면 각각 유지한다. 출력 질문 수가 입력의 85% 미만이면 잘못 처리한 것이다. 인위적으로 새 질문을 만들지 않는다. 메인 키워드의 진료 주제와 무관한 질문(예: 병원 키워드에 국회의원·부동산 질문)은 제외한다. 각 질문에 isLocal(특정 지역·위치에 묶인 질문인지)과 source(원본 출처 태그 [네이버]→naver, [구글]→google, 병합 시 다수 출처)를 기록한다. 단계 배정 기준: 원리·증상·정보 탐색=exploration, 후기·가격·병원 간 비교·추천 요청=comparison, 어디로 갈지 결정·예약·상담=decision, 시술 후 회복·관리·부작용 대처=retention.",
    messages: [
      {
        role: "user",
        content: `메인 키워드: ${query}\n\n원시 질문 목록:\n${rawQuestions.map((q) => `- [${q.source === "google" ? "구글" : "네이버"}] ${q.text}`).join("\n")}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("AI 가 구조화를 거절했습니다.");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("AI 응답이 비어 있습니다.");
  const parsed = JSON.parse(textBlock.text) as { categories: PaaTree["categories"] };
  return { name: query, categories: parsed.categories };
}

export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  if (!naverOpenApiConfigured()) {
    return NextResponse.json({ error: "네이버 오픈API 키가 설정되지 않았습니다." }, { status: 503 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const query = normalizeQuery(String(body.query || ""));
    const advertiser = String(body.advertiser || "").trim() || null;
    const refresh = Boolean(body.refresh);
    if (!query) return NextResponse.json({ error: "키워드를 입력하세요." }, { status: 400 });

    const latest = await db.paaSnapshot.findFirst({
      where: { query },
      orderBy: { createdAt: "desc" },
    });

    // 영구 캐시: 스냅샷이 있으면 그대로 반환
    if (latest && !refresh) {
      return NextResponse.json({
        source: "cache",
        snapshotId: latest.id,
        createdAt: latest.createdAt.toISOString(),
        query,
        region: latest.region,
        topic: latest.topic,
        rawCount: latest.rawCount,
        tree: latest.result as unknown as PaaTree,
        diff: null,
      });
    }

    const { region, topic } = parseRegion(query);
    let rawQuestions = dedupeRaw(await collectQuestions(query));

    // 좁은 지역이라 질문이 적으면 상위 지역으로 한 단계씩 넓혀 보충 수집
    const MIN_QUESTIONS = 10;
    const expanded: string[] = [];
    if (rawQuestions.length < MIN_QUESTIONS && region) {
      const regionTokens = region.split(" ");
      for (let drop = 1; rawQuestions.length < MIN_QUESTIONS && drop <= regionTokens.length; drop++) {
        const broaderRegion = regionTokens.slice(0, regionTokens.length - drop).join(" ");
        const broaderQuery = [broaderRegion, topic].filter(Boolean).join(" ").trim();
        if (!broaderQuery || broaderQuery === query) continue;
        try {
          const more = await collectQuestions(broaderQuery);
          if (more.length > 0) {
            rawQuestions = dedupeRaw([...rawQuestions, ...more]);
            expanded.push(broaderQuery);
          }
        } catch {
          // 확장 수집 실패는 치명적이지 않음
        }
      }
    }

    if (rawQuestions.length === 0) {
      return NextResponse.json(
        { error: `"${query}" 관련 질문을 찾지 못했습니다. 키워드를 넓혀보세요.` },
        { status: 404 }
      );
    }

    const tree = await structureWithAI(query, rawQuestions);
    reconcileMissing(tree, rawQuestions, region, query);
    if (expanded.length > 0) tree.expanded = expanded;

    const snapshot = await db.paaSnapshot.create({
      data: {
        query,
        region,
        topic,
        advertiser,
        result: tree as unknown as object,
        rawCount: rawQuestions.length,
      },
    });

    const diff = latest ? diffTrees(latest.result as unknown as PaaTree, tree) : null;

    return NextResponse.json({
      source: "fresh",
      snapshotId: snapshot.id,
      createdAt: snapshot.createdAt.toISOString(),
      query,
      region,
      topic,
      rawCount: rawQuestions.length,
      tree,
      diff,
    });
  } catch (err) {
    console.error("PAA 분석 오류:", err);
    return NextResponse.json(
      { error: "질문 수집·분석 중 오류가 발생했습니다. 잠시 후 다시 시도하세요." },
      { status: 500 }
    );
  }
}
