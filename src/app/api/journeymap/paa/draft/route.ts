import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { scanRisk } from "@/lib/journeymap/risk";
import { requireStaff } from "../../guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 환자 질문 1건 → 의료광고법 준수 블로그 초안 생성 + 결과물 리스크 재검수

const MODEL = "claude-opus-5";

export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY 가 설정되지 않았습니다." }, { status: 503 });
  }

  try {
    const body = await req.json();
    const question = String(body.question || "").trim();
    const category = String(body.category || "").trim();
    const isLocal = Boolean(body.isLocal);
    const query = String(body.query || "").trim();
    const advertiser = String(body.advertiser || "").trim();
    if (!question) return NextResponse.json({ error: "질문이 없습니다." }, { status: 400 });

    const channel = isLocal ? "네이버 플레이스·지역 랜딩페이지" : "블로그 정보성 원고";
    const client = new Anthropic();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      output_config: { effort: "low" },
      system: [
        "당신은 한국 병원 마케팅 전문 콘텐츠 작가다. 의료광고법(제56조)을 엄격히 준수한다.",
        "절대 금지: 치료효과 보장(100%, 완치, 부작용 없음, 영구적), 최상급·비교 표현(최고, 1등, 유일), 가격 유인(최저가, 할인, 이벤트, 무료), 치료경험담 유도, 타 병원 비방.",
        "허용: 객관적 시술 정보, 과정 설명, 일반적 회복 안내, '개인차가 있습니다' 고지.",
        "사실 날조 금지: 구체적 가격·기간·성공률 등 수치를 임의로 제시하지 않는다. 비용 질문에는 '병원·상태에 따라 다르며 정확한 비용은 병원의 비급여 진료비 고지를 확인하시라'는 안내로 답한다.",
        "AI 검색(GEO) 최적화 구조로 작성: ① 핵심 답변 3줄 요약을 맨 위에 ② 소제목 있는 본문(질문에 직접 답하는 Q&A 흐름) ③ 마지막에 FAQ 3개(짧은 질문·답변) ④ 부작용·개인차 고지 문장 포함.",
        "출력은 마크다운. 전체 800~1200자. 제목은 # 으로 시작.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            `메인 키워드: ${query}`,
            `환자 질문: ${question}`,
            category ? `카테고리: ${category}` : "",
            `게재 채널: ${channel}`,
            advertiser ? `병원명: ${advertiser} (병원명은 마지막 문의 안내에서 1회만 언급)` : "",
            "",
            "이 환자 질문에 정면으로 답하는 원고 초안을 작성하라.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "AI 가 초안 생성을 거절했습니다." }, { status: 502 });
    }
    const textBlock = response.content.find((b) => b.type === "text");
    const draft = textBlock && textBlock.type === "text" ? textBlock.text : "";
    if (!draft) return NextResponse.json({ error: "초안이 비어 있습니다." }, { status: 502 });

    // 생성 결과물을 기존 리스크 엔진으로 문장 단위 재검수
    const riskHits: { line: string; level: string; law: string; description: string }[] = [];
    for (const line of draft.split("\n")) {
      const r = scanRisk(line);
      if (r.level !== "none") {
        for (const reason of r.reasons) {
          riskHits.push({
            line: line.trim().slice(0, 80),
            level: r.level,
            law: reason.law,
            description: reason.description,
          });
        }
      }
    }

    return NextResponse.json({ draft, riskHits });
  } catch (err) {
    console.error("초안 생성 오류:", err);
    return NextResponse.json({ error: "초안 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
