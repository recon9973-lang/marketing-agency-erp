// src/app/api/marketing/cron/route.ts
//
// 성과수집·알림·동기화 배치 트리거(서버·크론 경로).
// - POST: 외부 스케줄러용. MARKETING_CRON_SECRET 환경변수와 x-cron-secret 헤더 일치 필요.
// - GET:  Vercel Cron 전용(vercel.json crons). CRON_SECRET 환경변수를 설정하면
//         Vercel이 Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 붙여 호출한다.
//         GET은 일일 잡 2종(알림 스위프 + 채널 동기화)을 순차 실행한다(멱등).
//
// 사용 예(POST):
//   curl -X POST https://erp.example.com/api/marketing/cron \
//     -H "x-cron-secret: $MARKETING_CRON_SECRET" -H "Content-Type: application/json" \
//     -d '{"reportingMonth":"2026-07-01","configByClient":{"<clientId>":{"keywords":["강남 임플란트"],"target":"myclinic.co.kr","channel":"blog"}}}'

import { NextRequest, NextResponse } from "next/server";
import { runMonthlyPerformanceCollection } from "@/server/marketing/research";
import { runDailyAlerts } from "@/server/jobs/daily-alerts";
import { runGuardRankWatch } from "@/server/jobs/guard-rank";
import { runChannelSync } from "@/server/jobs/channel-sync";
import { runMagazineAutoDraft } from "@/server/jobs/magazine";
import { runGeoWatch } from "@/server/geo-engine/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vercel Cron 진입점 — 하루 1회(vercel.json) 알림·동기화를 함께 실행. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const alerts = await runDailyAlerts();
    // 월보장 순위 감시 — 보장 키워드 이탈/미달/급락 시 담당자에게 알림(멱등).
    const guardRank = await runGuardRankWatch();
    const sync = await runChannelSync();
    // 매거진 자동 초안 — 큐에서 하루 N건만 초안 생성(발행은 사람 검토 후, 안전 램프업)
    const magazine = await runMagazineAutoDraft();
    // GEO 자동 관측은 주 1회(월요일)만 — 엔진 API 비용 상한(질문×엔진×주1회)
    const isMonday = new Date().getUTCDay() === 1;
    const geoWatch = isMonday ? await runGeoWatch() : null;
    return NextResponse.json({ ok: true, alerts, guardRank, sync, magazine, geoWatch });
  } catch (e) {
    console.error("[marketing/cron] daily jobs failed", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

type CronBody = {
  job?: "alerts" | "guard-rank" | "sync" | "geo-watch" | "magazine-draft" | "collection";
  reportingMonth?: string;
  configByClient?: Record<string, { keywords: string[]; target: string; channel?: "blog" | "web" | "local" }>;
};

export async function POST(req: NextRequest) {
  const secret = process.env.MARKETING_CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: CronBody;
  try {
    body = (await req.json()) as CronBody;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  // 일일 알림 스위프(§7·§15) — {"job":"alerts"}로 하루 1회 호출(같은 날 중복 발송 방지, 멱등).
  if (body.job === "alerts") {
    try {
      const result = await runDailyAlerts();
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      console.error("[marketing/cron] daily alerts failed", e);
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  // 월보장 순위 감시 — {"job":"guard-rank"}로 트리거. 보장 키워드 이탈/미달/급락 알림(멱등).
  if (body.job === "guard-rank") {
    try {
      const result = await runGuardRankWatch();
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      console.error("[marketing/cron] guard rank watch failed", e);
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  // GEO 자동 관측 — {"job":"geo-watch"}로 수동/외부 스케줄 트리거(멱등 — 같은 날 중복 호출 안 함).
  if (body.job === "geo-watch") {
    try {
      const result = await runGeoWatch();
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      console.error("[marketing/cron] geo watch failed", e);
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  // 매거진 자동 초안 — {"job":"magazine-draft"}로 트리거. 큐 상위 N건만 초안 생성(발행 아님).
  if (body.job === "magazine-draft") {
    try {
      const result = await runMagazineAutoDraft();
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      console.error("[marketing/cron] magazine autodraft failed", e);
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  // 채널 지표 동기화(§13) — {"job":"sync"}로 하루 1회. GSC/GA4 → ChannelMetric upsert(멱등).
  if (body.job === "sync") {
    try {
      const result = await runChannelSync();
      return NextResponse.json({ ok: true, ...result });
    } catch (e) {
      console.error("[marketing/cron] channel sync failed", e);
      return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  const { reportingMonth, configByClient } = body;
  if (!reportingMonth || !configByClient || typeof configByClient !== "object") {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  try {
    const result = await runMonthlyPerformanceCollection(reportingMonth, configByClient);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // 원인은 서버 로그로만. 사용자에게는 안전 메시지.
    console.error("[marketing/cron] collection failed", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
