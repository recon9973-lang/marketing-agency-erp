import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { scanRisk } from "@/lib/journeymap/risk";
import { requireStaff } from "../../guard";

export const dynamic = "force-dynamic";
// 웹 검색 최대 3회 + 분량 미달 시 2차 확장까지 하면 60초를 넘기기 쉽다.
// 60초였을 때 Vercel 이 요청을 끊어 화면에 "서버 요청 실패" 만 떴다.
export const maxDuration = 300;

// 환자 질문 1건 → 웹 검색 근거 기반·AI 글쓰기 스타일(GEO/E-E-A-T) 블로그 초안 생성
// + 실제 검색 출처로 "참고 자료" 자동 구성(URL 날조 원천 차단) + 의료광고법 재검수

const MODEL = "claude-opus-5";

// 공신력 도메인 화이트리스트 — 이 안에서만 웹 검색이 실행된다.
// 국내 공공·협회 + 주요 대학병원 + 해외 의료기관. (목록에 없는 도메인은 검색 결과에서 제외)
const TRUSTED_DOMAINS = [
  // 공공기관
  "kdca.go.kr", "health.kdca.go.kr", "hira.or.kr", "nhis.or.kr", "mohw.go.kr",
  // 협회·학회
  "kma.org", "akom.org", "kda.or.kr", "kams.or.kr",
  // 대학병원·상급종합병원
  "snuh.org", "snubh.org", "amc.seoul.kr", "samsunghospital.com",
  "severance.healthcare", "yuhs.or.kr", "cmcseoul.or.kr", "kumc.or.kr",
  "khmc.or.kr", "ajoumc.or.kr", "gilhospital.com", "eumc.ac.kr",
  "pnuh.or.kr", "knuh.kr", "cnuh.com", "jbuh.co.kr",
  // 해외 의료기관·공공 의학정보
  "mayoclinic.org", "clevelandclinic.org", "medlineplus.gov", "nih.gov",
  "pubmed.ncbi.nlm.nih.gov", "cdc.gov", "who.int", "nhs.uk", "hopkinsmedicine.org",
];

// AI 글쓰기 12지침 (사용자 확정 2026-08-02 — ai-content-writer 스킬 기반)
const WRITING_STYLE = [
  "AI 글쓰기 12지침을 반드시 적용한다:",
  "1. 의미·맥락 중심 설계 — 키워드 나열이 아니라 검색 의도(환자의 상황·고민)를 중심으로 콘텐츠를 설계한다.",
  "2. 질의응답(Q&A) 구조 — 환자의 실제 질문(검색 의도)에 본문이 정면으로 답하도록 '내용'을 설계한다. 단, 질문-답 '형식'은 FAQ 섹션의 몫이다: 본문 소제목을 질문문으로 쓰지 말고, 각 섹션 첫 문장이 그 주제의 결론을 서술문으로 말하게 하라.",
  "3. FAQ와 연관 질문 — 마지막에 연관 질문 5~7개를 FAQ 로 배치하고, 각 답변은 150자 이상 실질 정보로 채운다. 질문형 문장은 이 FAQ 섹션에만 나타나야 한다.",
  "4. 역피라미드(즉답형) — 결론·핵심을 맨 앞에. 리드 문단은 완결형 문장('~입니다')으로 즉답한다.",
  "5. 출처 활용 — 웹 검색으로 확인된 공신력 기관 자료를 근거로 서술해 신뢰도를 높인다.",
  "6. 주제 일관성·전문성 — 이 질문 하나를 깊게 다루고, 무관한 주제를 섞지 않는다.",
  "7. 데이터 구조화 — 비교는 마크다운 표, 절차는 번호 리스트, 핵심 요점은 불릿으로 정리한다.",
  "8. 독창적 관점·프레임워크 — '3단계 확인법' 같은 숫자 프레임워크 1개를 축으로 삼고, '흔히 A로 알려져 있지만 실제로는 B' 형태의 통념 교정을 1회 포함한다(검색 근거 있는 내용만).",
  "9. Executive Summary 와 심층 분석 균형 — 요약 리드 후 본문에서 배경→핵심 인사이트→실행 안내 순으로 깊이를 더한다.",
  "10. E-E-A-T 강화 — 전문 용어는 첫 등장 시 쉽게 풀이하고, 장점만이 아니라 한계·주의점도 명시한다. 특정 환자 경험담·후기는 만들지 않는다(의료광고법 금지).",
  "11. 데이터·통계·숫자 활용 — 검색으로 확인된 수치·통계를 적극 인용한다. 단, 검색 결과에 없는 수치는 절대 만들지 않는다.",
  "12. 첫 문장은 핵심 키워드로 시작 — 원고의 첫 문장(리드 첫 문장)을 메인 키워드로 시작한다.",
].join("\n");

interface SourceRef {
  url: string;
  title: string;
}

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

    const system = [
      "당신은 한국 병원 마케팅 전문 콘텐츠 작가다. 의료광고법(제56조)을 엄격히 준수한다.",
      "절대 금지: 치료효과 보장(100%, 완치, 부작용 없음, 영구적), 최상급·비교 표현(최고, 1등, 유일), 가격 유인(최저가, 할인, 이벤트, 무료), 치료경험담 유도, 타 병원 비방.",
      "허용: 객관적 시술 정보, 과정 설명, 일반적 회복 안내, '개인차가 있습니다' 고지.",
      "근거 기반 작성: 웹 검색 도구로 대학병원·공공기관·학회의 실제 자료를 확인하고, 검색으로 확인된 내용만 사실·수치로 서술한다. 검색 결과에 없는 가격·기간·성공률·통계는 절대 만들어 쓰지 않는다. 비용 질문에는 '병원·상태에 따라 다르며 정확한 비용은 병원의 비급여 진료비 고지를 확인하시라'는 안내로 답한다.",
      "출처 표기('## 참고 자료' 섹션, '출처:' 문구, URL)는 직접 작성하지 마라 — 시스템이 실제 검색 인용 위치의 문단 아래에 자동 삽입한다.",
      WRITING_STYLE,
      "구성: 제목(#) → 즉답형 리드 → 서술형 소제목 본문 4~6개(원리·절차·비용/보험·주의사항 등, 표·리스트 활용) → FAQ 5~7개 → 부작용·개인차 고지 문장.",
      "본문 소제목 형식 필수 준수: 명사형 또는 주장형 서술(예: '교통사고 후 한방 검사의 범위', '엑스레이 촬영은 협력 의료기관에서 진행됩니다')로 쓰고 물음표를 쓰지 마라. 질문형 소제목·문답 형식은 FAQ 섹션에서만 허용된다 — FAQ 가 이미 있으므로 본문까지 문답이면 글 전체가 FAQ 두 벌이 된다.",
      "분량 필수 준수: 전체 2,500~3,000자(공백 포함). 본문 소제목 섹션마다 350~500자로 충분히 상세하게 쓴다. 2,500자 미만 출력은 잘못된 것이다.",
      "출력은 마크다운. 제목은 # 으로 시작.",
    ].join("\n");

    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: [
          `메인 키워드: ${query}`,
          `환자 질문: ${question}`,
          category ? `카테고리: ${category}` : "",
          `게재 채널: ${channel}`,
          advertiser ? `병원명: ${advertiser} (병원명은 마지막 문의 안내에서 1회만 언급)` : "",
          "",
          "먼저 웹 검색으로 이 질문에 대한 공신력 있는 의학 근거를 확인한 뒤, 그 근거를 바탕으로 환자 질문에 정면으로 답하는 원고 초안을 작성하라.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];

    // 서버 측 검색 루프 — 긴 검색 턴은 pause_turn 으로 돌아올 수 있어 이어서 재요청한다
    let response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "low" },
      system,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
          allowed_domains: TRUSTED_DOMAINS,
        },
      ],
      messages,
    });
    for (let i = 0; i < 3 && response.stop_reason === "pause_turn"; i++) {
      messages.push({ role: "assistant", content: response.content });
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        output_config: { effort: "low" },
        system,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
            allowed_domains: TRUSTED_DOMAINS,
          },
        ],
        messages,
      });
    }
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "AI 가 초안 생성을 거절했습니다." }, { status: 502 });
    }

    // 본문 조립 — 텍스트 블록을 이어 붙이면서 인용(citation)이 달린 위치를 기억한다.
    // 출처는 하단 목록이 아니라 **인용된 문장이 속한 문단 바로 아래** 개별 표기한다(사용자 요청).
    // URL·제목은 인용 메타데이터만 사용 — AI 가 출처를 지어낼 수 없다.
    let draft = "";
    const sources: SourceRef[] = [];
    const seenUrls = new Set<string>();
    const pendings: { pos: number; sources: SourceRef[] }[] = [];
    for (const block of response.content) {
      if (block.type !== "text") continue;
      draft += block.text;
      if (!block.citations) continue;
      const here: SourceRef[] = [];
      for (const c of block.citations) {
        if (c.type === "web_search_result_location" && c.url && !here.some((s) => s.url === c.url)) {
          const ref = { url: c.url, title: c.title || c.url };
          here.push(ref);
          if (!seenUrls.has(c.url)) {
            seenUrls.add(c.url);
            sources.push(ref);
          }
        }
      }
      if (here.length > 0) pendings.push({ pos: draft.length, sources: here });
    }
    if (!draft.trim()) return NextResponse.json({ error: "초안이 비어 있습니다." }, { status: 502 });

    // 인용 블록은 문장 중간에서 끝날 수 있으므로 표기는 다음 문단 경계(빈 줄)에 넣는다.
    // 같은 문단에 몰린 인용은 한 자리에 모으고 URL 중복은 제거. 뒤에서부터 삽입해야
    // 앞쪽 삽입이 뒤쪽 위치를 밀어내지 않는다.
    const byInsertAt = new Map<number, SourceRef[]>();
    for (const p of pendings) {
      const nl = draft.indexOf("\n\n", p.pos);
      const at = nl === -1 ? draft.length : nl;
      const bucket = byInsertAt.get(at) ?? [];
      for (const s of p.sources) {
        if (!bucket.some((b) => b.url === s.url)) bucket.push(s);
      }
      byInsertAt.set(at, bucket);
    }
    for (const at of Array.from(byInsertAt.keys()).sort((a, b) => b - a)) {
      const lines = byInsertAt
        .get(at)!
        .map((s) => `▸ 출처: ${s.title} — ${s.url}`)
        .join("\n");
      draft = `${draft.slice(0, at)}\n${lines}${draft.slice(at)}`;
    }

    // 분량 미달 시 확장 2차 패스 (검색 근거가 이미 있어 드물게만 발동)
    if (draft.length < 2300) {
      const expandRes = await client.messages.create({
        model: MODEL,
        max_tokens: 6000,
        output_config: { effort: "low" },
        system:
          "당신은 의료광고법을 준수하는 병원 콘텐츠 편집자다. 전달받은 원고의 구조·제목·고지 문구는 유지하면서 각 본문 섹션과 FAQ 답변을 더 상세하게 확장한다. '▸ 출처:' 로 시작하는 줄은 실제 검색으로 확인된 출처 표기다 — 글자 하나 바꾸지 말고 원래 문단 아래 그대로 유지하라. 효과 보장·최상급·가격 유인 표현은 계속 금지. 원고에 없는 수치·출처·인용을 새로 만들지 마라. 결과는 전체 2,500~3,000자(공백 포함)의 완성 원고만 출력한다.",
        messages: [{ role: "user", content: draft }],
      });
      if (expandRes.stop_reason !== "refusal") {
        const expanded = expandRes.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        // 확장 과정에서 출처 표기가 하나라도 사라지면 확장본을 버린다 — 분량보다 출처가 먼저다.
        const keepsAllSources = sources.every((s) => expanded.includes(s.url));
        if (expanded.length > draft.length && keepsAllSources) draft = expanded;
      }
    }

    // 마무리 안내 — 출처는 본문 각 문단 아래에 이미 개별 표기되어 있다.
    if (sources.length > 0) {
      draft = `${draft.trim()}\n\n> 본문의 '▸ 출처' 표기는 원고 작성 시 실제 웹 검색으로 확인된 페이지입니다. 게재 전 원문을 한 번 더 확인하세요.`;
    }

    // 생성 결과물을 기존 리스크 엔진으로 문장 단위 재검수
    const riskHits: { line: string; level: string; law: string; description: string }[] = [];
    for (const line of draft.split("\n")) {
      // 면책 문구의 부정형("보장하지 않습니다" 등)은 금지 표현이 아니다 — 오탐 방지
      const negationStripped = line.replace(/(보장|재발\s*없음|부작용\s*없음)\s*(하지|되지|할 수 없|이 아니|은 없)[^,.]*/g, "");
      const r = scanRisk(negationStripped);
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

    return NextResponse.json({ draft, riskHits, sources });
  } catch (err) {
    console.error("초안 생성 오류:", err);
    return NextResponse.json({ error: "초안 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
