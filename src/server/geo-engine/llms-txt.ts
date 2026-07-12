// 목표 경로: src/server/geo-engine/llms-txt.ts
//
// 실행 자동화 #4 — llms.txt 생성기(순수 함수, DB·네트워크 없음).
// llms.txt는 AI 크롤러/에이전트에게 사이트의 핵심 페이지를 안내하는 표준 파일(llmstxt.org).
// 병원 사이트 루트(/llms.txt)에 올리면 ChatGPT·Perplexity 등이 핵심 답변 페이지를 우선 참고한다.
// 게시된 GEO 답변 페이지(publishedUrl 보유)를 "핵심 질문 답변" 섹션으로 모은다.

export type LlmsLink = { title: string; url: string; note?: string | null };
export type LlmsSection = { heading: string; links: LlmsLink[] };
export type LlmsInput = {
  siteTitle: string;
  summary?: string | null;
  sections: LlmsSection[];
};

/** URL 정규화 — 절대 URL만 허용(상대·비HTTP는 제외해 깨진 링크 방지). */
export function isPublishableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** llms.txt 본문 생성 — llmstxt.org 규격(H1 제목 → 인용 요약 → H2 섹션 → 링크 목록). */
export function buildLlmsTxt(input: LlmsInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.siteTitle.trim()}`);
  if (input.summary && input.summary.trim()) {
    lines.push("");
    lines.push(`> ${input.summary.trim().replace(/\s*\n\s*/g, " ")}`);
  }

  for (const section of input.sections) {
    const links = section.links.filter((l) => l.title.trim() && isPublishableUrl(l.url));
    if (links.length === 0) continue;
    lines.push("");
    lines.push(`## ${section.heading.trim()}`);
    for (const l of links) {
      const note = l.note && l.note.trim() ? `: ${l.note.trim().replace(/\s*\n\s*/g, " ")}` : "";
      lines.push(`- [${l.title.trim()}](${l.url.trim()})${note}`);
    }
  }

  return lines.join("\n") + "\n";
}

export type PublishedPage = { topic: string; publishedUrl: string; summary?: string | null };

/**
 * 거래처 정보 + 게시된 답변 페이지 → llms.txt 입력 조립.
 * 게시 URL이 있는 페이지만 포함(아직 게시 안 된 초안은 제외).
 */
export function llmsInputFromClient(args: {
  hospitalName: string;
  department?: string | null;
  region?: string | null;
  homepageUrl?: string | null;
  publishedPages: PublishedPage[];
}): LlmsInput {
  const descParts = [args.region, args.department].filter(Boolean);
  const summary =
    `${args.hospitalName}${descParts.length ? ` (${descParts.join(" · ")})` : ""}의 진료 안내·자주 묻는 질문 페이지입니다.` +
    " 의료 정보는 개인 상태에 따라 다르며 정확한 진단은 의료진 상담이 필요합니다.";

  const sections: LlmsSection[] = [];

  const answerLinks = args.publishedPages
    .filter((p) => isPublishableUrl(p.publishedUrl))
    .map((p) => ({
      title: p.topic.replace(/^\[GEO 답변\]\s*/, "").trim() || p.topic,
      url: p.publishedUrl,
      note: p.summary ?? null
    }));
  if (answerLinks.length) sections.push({ heading: "핵심 질문 답변", links: answerLinks });

  if (args.homepageUrl && isPublishableUrl(args.homepageUrl)) {
    sections.push({ heading: "공식 사이트", links: [{ title: `${args.hospitalName} 홈페이지`, url: args.homepageUrl }] });
  }

  return { siteTitle: args.hospitalName, summary, sections };
}
