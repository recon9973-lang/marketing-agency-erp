import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "../guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// LLM 보조 기능 (Claude API) — 시드 보강 + 저신뢰 여정 분류 보정 (§9.1 2단계, §9.3 2차)
// 필요 환경변수: ANTHROPIC_API_KEY

const STAGES = ["exploration", "comparison", "decision", "retention"] as const;
const MODEL = "claude-opus-5";

const SEEDS_SCHEMA = {
  type: "object",
  properties: {
    seeds: { type: "array", items: { type: "string" } },
  },
  required: ["seeds"],
  additionalProperties: false,
} as const;

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    labels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          stage: { type: "string", enum: [...STAGES] },
        },
        required: ["id", "stage"],
        additionalProperties: false,
      },
    },
  },
  required: ["labels"],
  additionalProperties: false,
} as const;

export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ unconfigured: true });
  }
  const client = new Anthropic();

  let body: {
    action?: string;
    mainKeyword?: string;
    profile?: {
      name?: string;
      departments?: string[];
      regionSigungu?: string;
      regionDong?: string;
      mainTreatments?: string[];
      targetAge?: string;
      competitors?: string[];
    };
    existingSeeds?: string[];
    keywords?: { id: string; keyword: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const p = body.profile ?? {};
  const profileText = `병원명: ${p.name ?? "-"} / 진료과: ${(p.departments ?? []).join(",") || "-"} / 지역: ${p.regionSigungu ?? ""} ${p.regionDong ?? ""} / 주력시술: ${(p.mainTreatments ?? []).join(",") || "-"} / 타깃: ${p.targetAge ?? "-"} / 경쟁병원: ${(p.competitors ?? []).join(",") || "-"}`;

  try {
    // ── 시드 보강: 규칙 템플릿이 못 만든 시드 5개 생성 (§9.1 2단계)
    if (body.action === "seeds") {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: SEEDS_SCHEMA },
        },
        system:
          "당신은 한국 병원 마케팅 키워드 전문가다. 환자가 네이버/구글에 실제로 입력할 법한 짧은 검색어(2~6단어)만 만든다. 의료법 위반 소지 표현(최저가, 이벤트가, 100%, 부작용 없음 등)은 금지.",
        messages: [
          {
            role: "user",
            content: `메인 키워드: "${body.mainKeyword}"\n병원 프로필: ${profileText}\n이미 있는 시드: ${(body.existingSeeds ?? []).join(", ")}\n\n위 시드에 없는 새로운 관점의 검색어 5개를 만들어라. 환자 여정(증상탐색/비교/병원결정/사후관리) 중 부족한 단계를 보완하라.`,
          },
        ],
      });
      if (response.stop_reason === "refusal") {
        return NextResponse.json({ seeds: [] });
      }
      const textBlock = response.content.find((b) => b.type === "text");
      const out = textBlock ? (JSON.parse(textBlock.text) as { seeds?: string[] }) : null;
      const seeds = (out?.seeds ?? [])
        .filter((s): s is string => typeof s === "string" && s.trim().length > 1)
        .slice(0, 5);
      return NextResponse.json({ seeds });
    }

    // ── 저신뢰 노드 여정 분류 보정 (§9.3 2차, 배치)
    if (body.action === "classify") {
      const kws = (body.keywords ?? []).slice(0, 40);
      if (kws.length === 0) return NextResponse.json({ corrections: {} });
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: CLASSIFY_SCHEMA },
        },
        system: `당신은 환자 검색여정 분류 전문가다. 각 키워드를 다음 4단계 중 하나로 분류한다:\nexploration(증상·원인·정보 탐색), comparison(방식·가격·후기 비교), decision(병원 선택·예약·위치), retention(시술 후 관리·회복).`,
        messages: [
          {
            role: "user",
            content: `병원 프로필: ${profileText}\n메인 키워드: "${body.mainKeyword}"\n\n분류할 키워드:\n${kws.map((k) => `${k.id}: ${k.keyword}`).join("\n")}`,
          },
        ],
      });
      if (response.stop_reason === "refusal") {
        return NextResponse.json({ corrections: {} });
      }
      const textBlock = response.content.find((b) => b.type === "text");
      const out = textBlock
        ? (JSON.parse(textBlock.text) as { labels?: { id: string; stage: string }[] })
        : null;
      const corrections: Record<string, string> = {};
      for (const item of out?.labels ?? []) {
        if ((STAGES as readonly string[]).includes(item.stage)) corrections[item.id] = item.stage;
      }
      return NextResponse.json({ corrections });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 200 });
  }
}
