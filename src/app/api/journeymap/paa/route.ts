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
              },
              required: ["text", "isLocal"],
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
  const url = `https://openapi.naver.com/v1/search/kin.json?query=${encodeURIComponent(query)}&display=30&sort=sim`;
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

// 두 소스 병렬 수집 — 한쪽 실패는 다른 쪽으로 계속 진행
async function collectQuestions(query: string): Promise<string[]> {
  const [naver, google] = await Promise.allSettled([fetchNaverKin(query), fetchGooglePaa(query)]);
  return [
    ...(naver.status === "fulfilled" ? naver.value : []),
    ...(google.status === "fulfilled" ? google.value : []),
  ];
}

async function structureWithAI(query: string, rawQuestions: string[]): Promise<PaaTree> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: STRUCTURE_SCHEMA },
    },
    system:
      "당신은 병원 마케팅 데이터 아키텍트다. 환자들의 원시 질문 목록을 의미 기준 4~6개 대분류로 묶고, 각 대분류에 검색여정 단계를 배정하며, 질문은 원래 의미를 보존한 간결한 완성형 문장으로 정제한다. 광고성·중복 질문은 병합하되 인위적으로 새 질문을 만들지 않는다. 각 질문에 isLocal(특정 지역·위치에 묶인 질문인지)을 판정한다. 단계 배정 기준: 원리·증상·정보 탐색=exploration, 후기·가격·병원 간 비교·추천 요청=comparison, 어디로 갈지 결정·예약·상담=decision, 시술 후 회복·관리·부작용 대처=retention.",
    messages: [
      {
        role: "user",
        content: `메인 키워드: ${query}\n\n원시 질문 목록:\n${rawQuestions.map((q) => `- ${q}`).join("\n")}`,
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
    let rawQuestions = Array.from(new Set(await collectQuestions(query)));

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
            rawQuestions = Array.from(new Set([...rawQuestions, ...more]));
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
