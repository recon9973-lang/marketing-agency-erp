// 목표 경로: src/server/geo-engine/engines.ts
//
// GEO 자동 관측 — AI 답변 엔진 어댑터(공식 API만 사용, 스크래핑 없음).
// 각 어댑터는 "환자 질문"을 검색 결합 모드로 물어 답변 텍스트 + 인용 URL을 돌려준다.
// 이 모듈은 DB를 모른다(순수 외부 호출) — 별도 서비스로 분리 가능하도록 격리.
//
// 환경변수:
//  OPENAI_API_KEY (+OPENAI_MODEL, 기본 gpt-4o-mini)
//  PERPLEXITY_API_KEY (+PERPLEXITY_MODEL, 기본 sonar)
//  GOOGLE_AI_API_KEY (+GEMINI_MODEL, 기본 gemini-2.0-flash)
//  ANTHROPIC_API_KEY (+GEO_ANTHROPIC_MODEL, 기본 claude-haiku-4-5-20251001)

export type EngineAnswer = { text: string; citations: string[] };
export type EngineAdapter = {
  engine: "CHATGPT" | "PERPLEXITY" | "GEMINI" | "CLAUDE";
  configured: () => boolean;
  ask: (question: string) => Promise<EngineAnswer>;
};

const TIMEOUT_MS = 45_000;

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

// ── Perplexity (sonar — 검색 네이티브) ─────────────────────────────────────
const perplexity: EngineAdapter = {
  engine: "PERPLEXITY",
  configured: () => Boolean(process.env.PERPLEXITY_API_KEY),
  async ask(question) {
    const res = await post(
      "https://api.perplexity.ai/chat/completions",
      { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
      {
        model: process.env.PERPLEXITY_MODEL || "sonar",
        messages: [{ role: "user", content: question }]
      }
    );
    if (!res.ok) throw new Error(`PERPLEXITY_${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
      search_results?: Array<{ url?: string }>;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    const citations = [
      ...(data.citations ?? []),
      ...(data.search_results?.map((s) => s.url).filter((u): u is string => Boolean(u)) ?? [])
    ];
    return { text, citations };
  }
};

// ── OpenAI (Responses API + web_search) ───────────────────────────────────
const chatgpt: EngineAdapter = {
  engine: "CHATGPT",
  configured: () => Boolean(process.env.OPENAI_API_KEY),
  async ask(question) {
    const res = await post(
      "https://api.openai.com/v1/responses",
      { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        tools: [{ type: "web_search_preview" }],
        input: question
      }
    );
    if (!res.ok) throw new Error(`OPENAI_${res.status}`);
    const data = (await res.json()) as {
      output?: Array<{
        type: string;
        content?: Array<{ type: string; text?: string; annotations?: Array<{ type: string; url?: string }> }>;
      }>;
    };
    let text = "";
    const citations: string[] = [];
    for (const item of data.output ?? []) {
      if (item.type !== "message") continue;
      for (const c of item.content ?? []) {
        if (c.type === "output_text") {
          text += c.text ?? "";
          for (const a of c.annotations ?? []) {
            if (a.type === "url_citation" && a.url) citations.push(a.url);
          }
        }
      }
    }
    return { text, citations };
  }
};

// ── Gemini (generateContent + google_search 그라운딩) ─────────────────────
const gemini: EngineAdapter = {
  engine: "GEMINI",
  configured: () => Boolean(process.env.GOOGLE_AI_API_KEY),
  async ask(question) {
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const res = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {},
      {
        contents: [{ parts: [{ text: question }] }],
        tools: [{ google_search: {} }]
      }
    );
    if (!res.ok) throw new Error(`GEMINI_${res.status}`);
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string } }> };
      }>;
    };
    const cand = data.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const citations =
      cand?.groundingMetadata?.groundingChunks?.map((c) => c.web?.uri).filter((u): u is string => Boolean(u)) ?? [];
    return { text, citations };
  }
};

// ── Claude (Messages API + web_search 도구) ───────────────────────────────
const claude: EngineAdapter = {
  engine: "CLAUDE",
  configured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  async ask(question) {
    const res = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
      {
        model: process.env.GEO_ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: question }]
      }
    );
    if (!res.ok) throw new Error(`ANTHROPIC_${res.status}`);
    const data = (await res.json()) as {
      content?: Array<{
        type: string;
        text?: string;
        citations?: Array<{ url?: string }>;
        content?: Array<{ type: string; url?: string }>;
      }>;
    };
    let text = "";
    const citations: string[] = [];
    for (const block of data.content ?? []) {
      if (block.type === "text") {
        text += block.text ?? "";
        for (const c of block.citations ?? []) if (c.url) citations.push(c.url);
      }
      if (block.type === "web_search_tool_result") {
        for (const r of block.content ?? []) if (r.type === "web_search_result" && r.url) citations.push(r.url);
      }
    }
    return { text, citations };
  }
};

export const ENGINE_ADAPTERS: EngineAdapter[] = [chatgpt, perplexity, gemini, claude];

/** 키가 설정된(호출 가능한) 엔진 목록. */
export function configuredEngines(): EngineAdapter[] {
  return ENGINE_ADAPTERS.filter((a) => a.configured());
}
