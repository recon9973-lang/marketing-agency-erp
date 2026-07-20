import crypto from "node:crypto";

/**
 * 네이버 검색광고 키워드도구 어댑터 (워크플로우 7차).
 *
 * 자격증명(NAVER_AD_*)이 env에 있으면 실제 API로 월간 검색수를 가져오고,
 * 없으면 "데모 추정치"(estimated=true)를 돌려준다. 키만 넣으면 실데이터로 바뀌며
 * 호출부 코드는 그대로다 → 실 서버 이관 시 재작업 없음.
 *
 * 실제 API: https://api.searchad.naver.com/keywordstool (HMAC-SHA256 서명 필요)
 */

const API_BASE = "https://api.searchad.naver.com";
const KEYWORDS_PATH = "/keywordstool";

export type KeywordVolume = {
  keyword: string;
  /** 월간 PC 검색수 */
  pc: number | null;
  /** 월간 모바일 검색수 */
  mobile: number | null;
  /** 월간 합계 */
  total: number | null;
  /** 경쟁 정도 (낮음/중간/높음) */
  competition: string | null;
  /** true면 미연동 상태의 데모 추정치(실제 검색량 아님). */
  estimated: boolean;
};

export function naverSearchConfigured(): boolean {
  return Boolean(
    process.env.NAVER_AD_API_KEY && process.env.NAVER_AD_SECRET && process.env.NAVER_AD_CUSTOMER_ID
  );
}

/** "< 10", "1,200", 1200 등 다양한 형태를 숫자로 정규화. */
export function toCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const digits = value.replace(/[^0-9]/g, "");
    if (!digits) return null;
    return Number(digits);
  }
  return null;
}

/** 키워드로부터 결정적(deterministic)인 데모 추정치를 만든다. 실제 검색량이 아님을 명시. */
export function demoVolume(keyword: string): KeywordVolume {
  let hash = 0;
  for (let i = 0; i < keyword.length; i += 1) {
    hash = (hash * 31 + keyword.charCodeAt(i)) >>> 0;
  }
  const total = 200 + (hash % 48000);
  const mobileRatio = 0.55 + ((hash >> 8) % 35) / 100;
  const mobile = Math.round(total * mobileRatio);
  const pc = total - mobile;
  const competition = ["낮음", "중간", "높음"][hash % 3];
  return { keyword, pc, mobile, total, competition, estimated: true };
}

function sign(timestamp: string, method: string, path: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${method}.${path}`).digest("base64");
}

export type RelatedKeyword = {
  keyword: string;
  pc: number | null;
  mobile: number | null;
  total: number | null;
  competition: string | null;
};

/**
 * 시드 키워드의 연관키워드 + 절대 월간 검색수를 실측 조회한다(검색광고 keywordstool).
 * 리스닝마인드식 키워드 확장의 뿌리 — CEP·검색여정 군집의 실측 시드가 된다.
 * 미연동 시 빈 배열(연관어 문자열을 지어내지 않는다 — 정직성 원칙). total 내림차순 정렬.
 */
export async function fetchRelatedKeywords(seed: string, limit = 100): Promise<RelatedKeyword[]> {
  const hint = seed.trim();
  if (!hint) return [];
  if (!naverSearchConfigured()) return []; // 미연동 → 데모 표기는 호출부(가짜 키워드 생성 금지)

  const apiKey = process.env.NAVER_AD_API_KEY as string;
  const secret = process.env.NAVER_AD_SECRET as string;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID as string;
  const timestamp = String(Date.now());
  const signature = sign(timestamp, "GET", KEYWORDS_PATH, secret);
  const url = `${API_BASE}${KEYWORDS_PATH}?hintKeywords=${encodeURIComponent(hint)}&showDetail=1`;

  // 네트워크·레이트리밋(429) 실패로 화면이 죽지 않도록 — 에러 시 빈 배열(호출부는 데모로 폴백).
  let list: Array<Record<string, unknown>> = [];
  try {
    const response = await fetch(url, {
      headers: { "X-Timestamp": timestamp, "X-API-KEY": apiKey, "X-Customer": customerId, "X-Signature": signature }
    });
    if (!response.ok) {
      console.warn(`[naver-ad] 연관키워드 조회 실패 ${response.status}(시드 ${hint})`);
      return [];
    }
    const json = (await response.json()) as { keywordList?: Array<Record<string, unknown>> };
    list = Array.isArray(json.keywordList) ? json.keywordList : [];
  } catch (e) {
    console.warn(`[naver-ad] 연관키워드 조회 예외(시드 ${hint}): ${String(e).slice(0, 120)}`);
    return [];
  }

  return list
    .map((row) => {
      const keyword = String(row.relKeyword ?? "").trim();
      const pc = toCount(row.monthlyPcQcCnt);
      const mobile = toCount(row.monthlyMobileQcCnt);
      const total = pc == null && mobile == null ? null : (pc ?? 0) + (mobile ?? 0);
      const compRaw = typeof row.compIdx === "string" ? row.compIdx : null;
      return { keyword, pc, mobile, total, competition: compRaw ? COMP_LABEL[compRaw] ?? compRaw : null };
    })
    .filter((r) => r.keyword.length > 0)
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    .slice(0, limit);
}

const COMP_LABEL: Record<string, string> = { 낮음: "낮음", 중간: "중간", 높음: "높음" };

/**
 * 키워드들의 월간 검색수를 조회한다. 최대 5개(hintKeywords 제한)까지 사용한다.
 * 미연동 시 데모 추정치를 반환한다.
 */
export async function fetchKeywordVolumes(keywords: string[]): Promise<KeywordVolume[]> {
  const cleaned = keywords.map((keyword) => keyword.trim()).filter(Boolean).slice(0, 5);
  if (cleaned.length === 0) return [];

  if (!naverSearchConfigured()) {
    return cleaned.map(demoVolume);
  }

  const apiKey = process.env.NAVER_AD_API_KEY as string;
  const secret = process.env.NAVER_AD_SECRET as string;
  const customerId = process.env.NAVER_AD_CUSTOMER_ID as string;
  const timestamp = String(Date.now());
  const signature = sign(timestamp, "GET", KEYWORDS_PATH, secret);
  const url = `${API_BASE}${KEYWORDS_PATH}?hintKeywords=${encodeURIComponent(cleaned.join(","))}&showDetail=1`;

  const response = await fetch(url, {
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": apiKey,
      "X-Customer": customerId,
      "X-Signature": signature
    }
  });

  if (!response.ok) {
    throw new Error(`네이버 검색광고 API 오류 (${response.status})`);
  }

  const json = (await response.json()) as { keywordList?: Array<Record<string, unknown>> };
  const list = Array.isArray(json.keywordList) ? json.keywordList : [];

  return cleaned.map((keyword) => {
    const norm = keyword.replace(/\s+/g, "").toLowerCase();
    const row = list.find(
      (item) => String(item.relKeyword ?? "").replace(/\s+/g, "").toLowerCase() === norm
    );
    if (!row) {
      return { keyword, pc: null, mobile: null, total: null, competition: null, estimated: false };
    }
    const pc = toCount(row.monthlyPcQcCnt);
    const mobile = toCount(row.monthlyMobileQcCnt);
    const total = pc == null && mobile == null ? null : (pc ?? 0) + (mobile ?? 0);
    const compRaw = typeof row.compIdx === "string" ? row.compIdx : null;
    return {
      keyword,
      pc,
      mobile,
      total,
      competition: compRaw ? COMP_LABEL[compRaw] ?? compRaw : null,
      estimated: false
    };
  });
}
