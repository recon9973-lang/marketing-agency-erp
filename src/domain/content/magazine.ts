// 목표 경로: src/domain/content/magazine.ts
//
// GROUND 매거진 콘텐츠 트랙 도메인 — 병원 고객 콘텐츠와 분리(의료법·거래처 승인 게이트 없음).
// 용어 리스트를 큐 아이템으로 파싱하는 순수 로직 + 카테고리·유형·상태 상수.

export const MAGAZINE_CATEGORIES = ["AEO/GEO", "SEO", "AI마케팅", "병원마케팅"] as const;
export type MagazineCategory = (typeof MAGAZINE_CATEGORIES)[number];

export const MAGAZINE_KINDS = ["glossary", "article", "howto", "news"] as const;
export type MagazineKind = (typeof MAGAZINE_KINDS)[number];

export const magazineKindLabels: Record<MagazineKind, string> = {
  glossary: "용어사전",
  article: "아티클",
  howto: "사용법",
  news: "동향"
};

// QUEUED(큐 대기) → DRAFTED(AI 초안) → REVIEWED(사람 검토) → PUBLISHED(발행)
export const MAGAZINE_STATUSES = ["QUEUED", "DRAFTED", "REVIEWED", "PUBLISHED"] as const;
export type MagazineStatus = (typeof MAGAZINE_STATUSES)[number];

export const magazineStatusLabels: Record<MagazineStatus, string> = {
  QUEUED: "큐 대기",
  DRAFTED: "초안",
  REVIEWED: "검토",
  PUBLISHED: "발행"
};

export function isMagazineCategory(v: string): v is MagazineCategory {
  return (MAGAZINE_CATEGORIES as readonly string[]).includes(v);
}
export function isMagazineKind(v: string): v is MagazineKind {
  return (MAGAZINE_KINDS as readonly string[]).includes(v);
}

export type MagazineDraftContent = {
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
  related: string[];
  faq: { q: string; a: string }[];
};

/** 매거진 초안 → 발행용 마크다운(BLUF 구조: 제목 → 핵심 요약 → 섹션 → 관련 → FAQ). 순수 함수. */
export function buildMagazineMarkdown(d: MagazineDraftContent): string {
  const parts: string[] = [];
  parts.push(`# ${d.title}`);
  parts.push("");
  parts.push(d.summary); // BLUF — 첫 문단에 핵심
  for (const s of d.sections) {
    parts.push("");
    parts.push(`## ${s.heading}`);
    parts.push(s.body);
  }
  if (d.faq.length) {
    parts.push("");
    parts.push("## 자주 묻는 질문");
    for (const f of d.faq) {
      parts.push(`**Q. ${f.q}**`);
      parts.push(`A. ${f.a}`);
      parts.push("");
    }
  }
  if (d.related.length) {
    parts.push("");
    parts.push(`**관련 용어:** ${d.related.join(" · ")}`);
  }
  return parts.join("\n").trim() + "\n";
}

export type ParsedTerm = { title: string; seed: string | null };

const SEPARATORS = ["::", "—", " - ", " – "]; // 우선순위: 명시적 → em/en 대시

/**
 * 용어 리스트(붙여넣기) → 큐 아이템 파싱.
 * 각 줄에서 목록 마커(1. - *)·굵게(**)를 제거하고, 구분자(:: 또는 대시)로 용어·정의(seed)를 나눈다.
 * 헤더(#)·인용(>)·빈 줄은 건너뛰고, 제목 기준으로 중복을 제거한다.
 */
export function parseMagazineTerms(raw: string): ParsedTerm[] {
  const out: ParsedTerm[] = [];
  const seen = new Set<string>();

  for (const rawLine of raw.split("\n")) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#") || line.startsWith(">") || line.startsWith("---")) continue;

    // 목록 마커 제거: "1." / "1)" / "-" / "*" / "•"
    line = line.replace(/^(\d+[.)]|[-*•])\s+/, "");
    // 굵게 마커 제거
    line = line.replace(/\*\*/g, "").trim();
    if (!line) continue;

    // 구분자 탐색 — 가장 먼저 등장하는 것으로 분리
    let title = line;
    let seed: string | null = null;
    let bestIdx = -1;
    let bestSep = "";
    for (const sep of SEPARATORS) {
      const idx = line.indexOf(sep);
      if (idx > 0 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx;
        bestSep = sep;
      }
    }
    if (bestIdx > 0) {
      title = line.slice(0, bestIdx).trim();
      seed = line.slice(bestIdx + bestSep.length).trim() || null;
    }

    title = title.trim();
    if (title.length < 2) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, seed });
  }

  return out;
}
