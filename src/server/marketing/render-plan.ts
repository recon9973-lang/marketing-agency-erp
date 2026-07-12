// 목표 경로: src/server/marketing/render-plan.ts
//
// 콘텐츠 기획(ContentPlan) → 발행용 제목/HTML 렌더러(순수 함수, DB·네트워크 없음).
// - GEO 답변 페이지는 markdown(draft)에 BLUF 구조 + FAQPage JSON-LD 코드펜스를 담는다.
//   → JSON-LD 펜스는 <script type="application/ld+json">로 승격, 나머지는 최소 마크다운→HTML.
// - 일반 기획은 angle(방향) + FAQ + Q&A로 조립한다.
// 발행 콘텐츠에 임의 HTML 주입을 막기 위해 텍스트는 모두 이스케이프한다.

export type RenderablePlan = {
  topic: string;
  angle: string | null;
  faq: string[];
  qa: { q: string; a: string }[];
  draft: string | null;
};

const ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPE[c]);
}

/** `**bold**`만 인라인 처리 후 이스케이프(태그 주입 방지). */
function inline(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** 발행 제목 — "[GEO 답변] " 접두어는 제거해 자연스러운 글 제목으로. */
export function planTitle(plan: RenderablePlan): string {
  return plan.topic.replace(/^\[GEO 답변\]\s*/, "").trim() || plan.topic;
}

/**
 * 최소 마크다운 → HTML. 우리 생성물(# / ## / > / 목록 / **굵게** / ```json 펜스)만 다룬다.
 * JSON-LD 펜스는 파싱 성공 시 <script>로 승격, 실패하면 통째로 생략(깨진 스크립트 방지).
 */
export function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 코드펜스: JSON-LD만 스크립트로 승격, 그 외 언어는 본문에서 제외
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim().toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) buf.push(lines[i++]);
      if (lang === "json") {
        try {
          const parsed = JSON.parse(buf.join("\n"));
          flush();
          out.push(`<script type="application/ld+json">${JSON.stringify(parsed)}</script>`);
        } catch {
          /* 깨진 JSON-LD는 게시하지 않는다 */
        }
      }
      continue;
    }
    if (trimmed.startsWith("<!--")) continue; // 편집용 주석 제거

    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flush();
      out.push(`<h2>${inline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      flush();
      out.push(`<h1>${inline(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("> ")) {
      flush();
      out.push(`<blockquote>${inline(trimmed.slice(2))}</blockquote>`);
    } else if (/^[-*]\s+/.test(trimmed)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`);
        i++;
      }
      i--;
      out.push(`<ul>${items.join("")}</ul>`);
    } else {
      para.push(trimmed);
    }
  }
  flush();
  return out.join("\n");
}

/** ContentPlan → { title, html }. draft(markdown) 우선, 없으면 angle/FAQ/Q&A로 조립. */
export function renderContentPlanForPublish(plan: RenderablePlan): { title: string; html: string } {
  const title = planTitle(plan);
  if (plan.draft && plan.draft.trim()) {
    return { title, html: markdownToHtml(plan.draft) };
  }

  const parts: string[] = [];
  if (plan.angle) parts.push(`<p>${inline(plan.angle)}</p>`);
  if (plan.qa.length) {
    parts.push("<h2>자주 묻는 질문</h2>");
    for (const x of plan.qa) {
      parts.push(`<h3>${inline(x.q)}</h3>`);
      parts.push(`<p>${inline(x.a)}</p>`);
    }
  } else if (plan.faq.length) {
    parts.push("<h2>자주 묻는 질문</h2>");
    parts.push(`<ul>${plan.faq.map((f) => `<li>${inline(f)}</li>`).join("")}</ul>`);
  }
  return { title, html: parts.join("\n") };
}
