// src/server/marketing/providers/naver.ts
//
// 네이버 리서치 provider — 서버·크론 경로(직접 API) 구현.
// (에이전트 경로에서는 PlayMCP 네이버 도구를 쓰지만, 정기 배치는 세션 MCP를
//  쓸 수 없으므로 서버가 네이버 Open API를 직접 호출한다. 기획서 §2.2 이중 실행 모델.)
//
// 필요 환경변수(.env):
//   NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET  → 검색 API(blog/local/web)
//   (DataLab도 동일 검색 앱 자격증명 사용)
// 미설정 시 throw 하지 않고 CONFIG_MISSING 결과를 반환한다(배치가 죽지 않게).

import {
  provOk,
  provFail,
  type ResearchProvider,
  type ProviderResult,
  type KeywordTrend,
  type KeywordTrendInput,
  type KeywordCompetition,
  type KeywordRank,
  type RankCheckInput,
  type LocalResult,
} from "./types";

const SEARCH_BASE = "https://openapi.naver.com/v1/search";
const DATALAB_URL = "https://openapi.naver.com/v1/datalab/search";

function creds(): { id: string; secret: string } | null {
  const id = process.env.NAVER_SEARCH_CLIENT_ID;
  const secret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

function authHeaders(c: { id: string; secret: string }): HeadersInit {
  return { "X-Naver-Client-Id": c.id, "X-Naver-Client-Secret": c.secret };
}

/** 기본 조회 구간: 최근 3개월. */
function defaultRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export const naverResearch: ResearchProvider = {
  async keywordTrend(input: KeywordTrendInput): Promise<ProviderResult<KeywordTrend>> {
    const c = creds();
    if (!c) return provFail("CONFIG_MISSING", "NAVER_SEARCH_CLIENT_ID/SECRET 미설정");
    if (!input.keywords.length) return provFail("INVALID_INPUT", "keywords 비어있음");

    const range = defaultRange();
    const body = {
      startDate: input.startDate ?? range.startDate,
      endDate: input.endDate ?? range.endDate,
      timeUnit: input.timeUnit ?? "month",
      // DataLab은 그룹당 키워드 배열. 시드별 1그룹으로 매핑(최대 5그룹 제한).
      keywordGroups: input.keywords.slice(0, 5).map((k) => ({ groupName: k, keywords: [k] })),
      ...(input.device && input.device !== "all" ? { device: input.device } : {}),
      ...(input.gender && input.gender !== "all" ? { gender: input.gender } : {}),
    };

    const started = Date.now();
    try {
      const res = await fetch(DATALAB_URL, {
        method: "POST",
        headers: { ...authHeaders(c), "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) return provFail("UNAUTHORIZED", "네이버 인증 실패");
      if (res.status === 429) return provFail("RATE_LIMITED", "네이버 호출 한도 초과");
      if (!res.ok) return provFail("UPSTREAM_ERROR", `DataLab ${res.status}`);
      const json = (await res.json()) as {
        results?: { title: string; data: { period: string; ratio: number }[] }[];
      };
      const trend: KeywordTrend = (json.results ?? []).map((r) => ({
        keyword: r.title,
        series: r.data ?? [],
      }));
      return provOk(trend, { source: "naver-datalab", elapsedMs: Date.now() - started });
    } catch (e) {
      return provFail("UPSTREAM_ERROR", "DataLab 요청 실패", e);
    }
  },

  async keywordCompetition(keyword: string): Promise<ProviderResult<KeywordCompetition>> {
    const c = creds();
    if (!c) return provFail("CONFIG_MISSING", "NAVER_SEARCH_CLIENT_ID/SECRET 미설정");
    const started = Date.now();
    try {
      const url = `${SEARCH_BASE}/blog.json?query=${encodeURIComponent(keyword)}&display=1`;
      const res = await fetch(url, { headers: authHeaders(c), cache: "no-store" });
      if (!res.ok) return provFail("UPSTREAM_ERROR", `search/blog ${res.status}`);
      const json = (await res.json()) as { total?: number };
      return provOk(
        { keyword, totalDocs: typeof json.total === "number" ? json.total : null, channel: "blog" },
        { source: "naver-search", elapsedMs: Date.now() - started },
      );
    } catch (e) {
      return provFail("UPSTREAM_ERROR", "경쟁강도 조회 실패", e);
    }
  },

  async rankCheck(input: RankCheckInput): Promise<ProviderResult<KeywordRank[]>> {
    const c = creds();
    if (!c) return provFail("CONFIG_MISSING", "NAVER_SEARCH_CLIENT_ID/SECRET 미설정");
    const channel = input.channel ?? "blog";
    const endpoint = channel === "local" ? "local" : channel === "web" ? "webkr" : "blog";
    const checkedAt = new Date().toISOString();
    const out: KeywordRank[] = [];
    for (const kw of input.keywords) {
      try {
        const url = `${SEARCH_BASE}/${endpoint}.json?query=${encodeURIComponent(kw)}&display=30`;
        const res = await fetch(url, { headers: authHeaders(c), cache: "no-store" });
        // API 오류(인증·쿼터·서버)는 "미노출"이 아니라 조회실패 → provFail로 즉시 반환.
        // (호출부 guard-rank가 !res.ok면 skip하여 허위 이탈 알림·null 스냅샷을 막는다.)
        if (res.status === 401 || res.status === 403) return provFail("UNAUTHORIZED", "네이버 인증 실패");
        if (res.status === 429) return provFail("RATE_LIMITED", "네이버 호출 한도 초과");
        if (!res.ok) return provFail("UPSTREAM_ERROR", `search/${endpoint} ${res.status}`);
        const json = (await res.json()) as { items?: { title?: string; link?: string }[] };
        const idx = (json.items ?? []).findIndex(
          (it) => (it.link ?? "").includes(input.target) || (it.title ?? "").includes(input.target),
        );
        // 200 정상 응답인데 결과 30건 안에 없음 = 진짜 미노출(rank:null 정당).
        out.push({ keyword: kw, rank: idx >= 0 ? idx + 1 : null, checkedAt });
      } catch (e) {
        return provFail("UPSTREAM_ERROR", "순위 조회 실패", e);
      }
    }
    return provOk(out, { source: "naver-search" });
  },

  async localSearch(query: string): Promise<ProviderResult<LocalResult[]>> {
    const c = creds();
    if (!c) return provFail("CONFIG_MISSING", "NAVER_SEARCH_CLIENT_ID/SECRET 미설정");
    try {
      const url = `${SEARCH_BASE}/local.json?query=${encodeURIComponent(query)}&display=5`;
      const res = await fetch(url, { headers: authHeaders(c), cache: "no-store" });
      if (!res.ok) return provFail("UPSTREAM_ERROR", `search/local ${res.status}`);
      const json = (await res.json()) as {
        items?: { title?: string; category?: string; address?: string; link?: string }[];
      };
      const results: LocalResult[] = (json.items ?? []).map((it, i) => ({
        title: (it.title ?? "").replace(/<[^>]+>/g, ""),
        category: it.category,
        address: it.address,
        link: it.link,
        rank: i + 1,
      }));
      return provOk(results, { source: "naver-search" });
    } catch (e) {
      return provFail("UPSTREAM_ERROR", "로컬 검색 실패", e);
    }
  },
};
