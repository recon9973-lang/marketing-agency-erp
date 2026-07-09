/**
 * 네이버 데이터랩(DataLab) 검색어 트렌드 어댑터 (워크플로우 18차).
 *
 * 네이버 Developers 오픈API(Client ID/Secret)로 키워드의 상대 검색 트렌드(0~100)를
 * 가져온다. 절대 월간검색수(검색광고 API)가 준비되면 그 어댑터로 바꿔 끼우면 된다.
 *
 * 문서: POST https://openapi.naver.com/v1/datalab/search
 * 인증: 헤더 X-Naver-Client-Id / X-Naver-Client-Secret
 */

const ENDPOINT = "https://openapi.naver.com/v1/datalab/search";

export type TrendPoint = { period: string; ratio: number };

export type KeywordTrend = {
  keyword: string;
  points: TrendPoint[];
  /** 최근값(0~100). 데이터 없으면 null. */
  latestRatio: number | null;
  /** 구간 첫값 대비 변화량(+상승/-하락). */
  delta: number | null;
  /** 구간 내 최고값. */
  peakRatio: number | null;
};

export function naverDatalabConfigured(): boolean {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

/** 최근 6개월 범위(YYYY-MM-DD). now를 주입하면 테스트가 결정적. */
export function trendDateRange(now = new Date()): { startDate: string; endDate: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function summarize(keyword: string, points: TrendPoint[]): KeywordTrend {
  if (points.length === 0) {
    return { keyword, points, latestRatio: null, delta: null, peakRatio: null };
  }
  const latest = points[points.length - 1].ratio;
  const first = points[0].ratio;
  const peak = points.reduce((max, point) => Math.max(max, point.ratio), 0);
  return {
    keyword,
    points,
    latestRatio: Math.round(latest * 10) / 10,
    delta: Math.round((latest - first) * 10) / 10,
    peakRatio: Math.round(peak * 10) / 10
  };
}

/**
 * 키워드들(최대 5개)의 검색 트렌드를 가져온다. 미연동이면 빈 배열.
 * 각 키워드를 개별 그룹으로 요청한다.
 */
export async function fetchKeywordTrends(keywords: string[], now = new Date()): Promise<KeywordTrend[]> {
  const cleaned = keywords.map((keyword) => keyword.trim()).filter(Boolean).slice(0, 5);
  if (cleaned.length === 0 || !naverDatalabConfigured()) {
    return [];
  }

  const { startDate, endDate } = trendDateRange(now);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID as string,
      "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET as string,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      startDate,
      endDate,
      timeUnit: "month",
      keywordGroups: cleaned.map((keyword) => ({ groupName: keyword, keywords: [keyword] }))
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`네이버 데이터랩 오류 (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const json = (await response.json().catch(() => ({}))) as {
    results?: Array<{ title?: string; data?: Array<{ period: string; ratio: number }> }>;
  };
  const results = Array.isArray(json.results) ? json.results : [];

  return cleaned.map((keyword) => {
    const group = results.find((item) => item.title === keyword);
    const points = Array.isArray(group?.data)
      ? group.data.map((point) => ({ period: point.period, ratio: point.ratio }))
      : [];
    return summarize(keyword, points);
  });
}
