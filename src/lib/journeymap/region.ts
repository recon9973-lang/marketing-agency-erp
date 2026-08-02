// 키워드를 "지역 + 시술(주제)" 로 분해한다. (PAA-GUIDE §1-10)
// 사전(시도·유명 지명) + 행정구역 접미 휴리스틱(…시/군/구/동/읍/면) 조합.

export type RegionLevel = "sido" | "sigungu" | "dong";

export interface RegionParse {
  region: string | null; // 예: "대구 달서구"
  topic: string | null; // 예: "임플란트"
  regionLevel: RegionLevel | null; // 가장 좁은 지역 단위
}

// 시도 + 접미사 없이 쓰이는 유명 지명 (필요 시 계속 확장)
const REGION_WORDS = new Set([
  "서울", "서울시", "서울특별시",
  "부산", "부산시", "부산광역시",
  "대구", "대구시", "대구광역시",
  "인천", "인천시", "인천광역시",
  "광주", "광주시", "광주광역시",
  "대전", "대전시", "대전광역시",
  "울산", "울산시", "울산광역시",
  "세종", "세종시", "세종특별자치시",
  "경기", "경기도", "강원", "강원도", "제주", "제주도",
  "충북", "충청북도", "충남", "충청남도",
  "전북", "전라북도", "전남", "전라남도",
  "경북", "경상북도", "경남", "경상남도",
  "강남", "서초", "송파", "강동", "강서", "강북", "노원", "마포",
  "홍대", "신촌", "목동", "잠실", "분당", "판교", "일산", "평촌",
  "동탄", "수지", "해운대", "서면", "수성", "달서",
]);

const SUFFIX_RE = /^[가-힣]{1,10}(시|군|구|동|읍|면|도)$/;

function levelOf(token: string): RegionLevel {
  if (/(동|읍|면)$/.test(token)) return "dong";
  if (/(구|군)$/.test(token) || (/시$/.test(token) && !REGION_WORDS.has(token))) return "sigungu";
  return "sido";
}

function isRegionToken(token: string): boolean {
  return REGION_WORDS.has(token) || SUFFIX_RE.test(token);
}

export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

export function parseRegion(rawQuery: string): RegionParse {
  const query = normalizeQuery(rawQuery);
  const tokens = query.split(" ");

  // 공백 없는 단일 토큰: 사전 지명이 앞에 붙었는지 검사 (예: "대구임플란트")
  if (tokens.length === 1) {
    const word = tokens[0];
    const prefixes = Array.from(REGION_WORDS).sort((a, b) => b.length - a.length);
    for (const p of prefixes) {
      if (word.startsWith(p) && word.length - p.length >= 2) {
        return { region: p, topic: word.slice(p.length), regionLevel: levelOf(p) };
      }
    }
    return isRegionToken(word)
      ? { region: word, topic: null, regionLevel: levelOf(word) }
      : { region: null, topic: word, regionLevel: null };
  }

  const regionTokens = tokens.filter(isRegionToken);
  const topicTokens = tokens.filter((t) => !isRegionToken(t));
  if (regionTokens.length === 0) return { region: null, topic: query, regionLevel: null };

  // 가장 좁은 단위를 대표 레벨로 (dong > sigungu > sido)
  const order: RegionLevel[] = ["dong", "sigungu", "sido"];
  const level = order.find((l) => regionTokens.some((t) => levelOf(t) === l)) ?? "sido";

  return {
    region: regionTokens.join(" "),
    topic: topicTokens.length > 0 ? topicTokens.join(" ") : null,
    regionLevel: level,
  };
}
