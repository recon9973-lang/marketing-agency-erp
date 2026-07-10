/**
 * 거래처 마케팅 인사이트 데모 데이터 백필(멱등·비파괴).
 *
 * 원칙:
 *  - 활성 거래처 중 인사이트 데이터(키워드/순위/채널지표)가 "하나도 없는" 거래처에만 채운다.
 *    이미 데이터가 있으면 건드리지 않으므로, 실데이터 입력 시 데모값이 덮이는 일이 없다.
 *  - createMany({ skipDuplicates })로 유니크 제약(@@unique) 충돌을 무시 → 재실행해도 안전.
 *  - 실패해도 빌드를 막지 않는다(exit 0). DB 미연결 시 스킵.
 *
 * 채널: place|blog|homepage / 지표: visitors|impressions / 최근 30일.
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  console.warn("[insights] DATABASE_URL 미설정 — 스킵");
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || url.replace("-pooler", "");
const prisma = new PrismaClient({ datasources: { db: { url: direct } }, log: ["error"] });

const DAYS = 30;
const CHANNELS = ["place", "blog", "homepage"];

// 결정적 PRNG — 거래처 id로 시드를 잡아 재빌드 시에도 값이 흔들리지 않게 한다.
function seedFrom(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h = (h ^= h >>> 16) >>> 0;
    return h / 4294967296;
  };
}

function dateOnly(daysAgo) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

// 병원 마케팅에서 흔한 키워드 골격(거래처명 접두 결합).
const CORE_SUFFIX = ["", " 예약", " 후기", " 비용", " 잘하는곳"];
const RELATED = ["여드름 흉터", "보톡스", "필러", "리프팅", "미백관리", "모공축소", "레이저토닝", "탈모치료", "다크서클", "제모"];

async function backfillClient(client) {
  const rng = seedFrom(client.id);
  const base = client.name.replace(/\s+/g, "");

  // 1) 키워드 — 없을 때만.
  if ((await prisma.keyword.count({ where: { clientId: client.id } })) === 0) {
    const coreRows = CORE_SUFFIX.map((sfx, i) => ({
      clientId: client.id,
      keyword: `${base}${sfx}`,
      intent: i === 0 ? "브랜드" : "정보",
      searchVolume: Math.round(400 + rng() * 5200),
      priority: i < 2 ? 1 : 2,
      channel: i % 2 === 0 ? "place" : "blog"
    }));
    const relatedRows = RELATED.map((kw) => ({
      clientId: client.id,
      keyword: kw,
      intent: "정보",
      searchVolume: Math.round(800 + rng() * 9000),
      priority: 3,
      channel: "blog"
    }));
    await prisma.keyword.createMany({ data: [...coreRows, ...relatedRows], skipDuplicates: true });
  }

  // 2) 검색 순위 추적 — 없을 때만. 대표 키워드 4개, 30일간 완만한 상승(순위 하락=개선).
  if ((await prisma.placeRankRecord.count({ where: { clientId: client.id } })) === 0) {
    const trackKeywords = [`${base}`, `${base} 예약`, RELATED[0], RELATED[1]];
    const rows = [];
    for (const kw of trackKeywords) {
      let rank = 8 + Math.floor(rng() * 10); // 8~17위 시작
      for (let d = DAYS - 1; d >= 0; d--) {
        rank = Math.max(1, rank - (rng() < 0.45 ? 1 : 0) + (rng() < 0.12 ? 1 : 0));
        rows.push({ clientId: client.id, keyword: kw, rank, recordedOn: dateOnly(d) });
      }
    }
    await prisma.placeRankRecord.createMany({ data: rows, skipDuplicates: true });
  }

  // 3) 채널 지표(방문자/노출) — 없을 때만. 주간 시즌성 + 완만한 우상향.
  if ((await prisma.channelMetric.count({ where: { clientId: client.id } })) === 0) {
    const rows = [];
    for (const channel of CHANNELS) {
      const visitorBase = channel === "place" ? 120 : channel === "blog" ? 80 : 45;
      const imprBase = channel === "place" ? 900 : channel === "blog" ? 1400 : 300;
      for (let d = DAYS - 1; d >= 0; d--) {
        const growth = 1 + (DAYS - d) * 0.008; // 우상향
        const weekend = [0, 6].includes(dateOnly(d).getUTCDay()) ? 0.8 : 1;
        const noise = 0.8 + rng() * 0.4;
        const visitors = Math.round(visitorBase * growth * weekend * noise);
        const impressions = Math.round(imprBase * growth * weekend * (0.85 + rng() * 0.3));
        rows.push({ clientId: client.id, channel, metric: "visitors", value: visitors, recordedOn: dateOnly(d) });
        rows.push({ clientId: client.id, channel, metric: "impressions", value: impressions, recordedOn: dateOnly(d) });
      }
    }
    await prisma.channelMetric.createMany({ data: rows, skipDuplicates: true });
  }
}

try {
  const clients = await prisma.client.findMany({ where: { active: true }, select: { id: true, name: true } });
  let touched = 0;
  for (const client of clients) {
    await backfillClient(client);
    touched += 1;
  }
  console.log(`[insights] 백필 완료 — 거래처 ${touched}개 점검`);
} catch (err) {
  console.warn(`[insights] 실패(무시하고 빌드 계속): ${String(err).slice(0, 200)}`);
} finally {
  await prisma.$disconnect().catch(() => undefined);
}
process.exit(0);
