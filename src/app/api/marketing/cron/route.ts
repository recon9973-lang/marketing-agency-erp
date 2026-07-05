// src/app/api/marketing/cron/route.ts
//
// 성과수집 배치 트리거(서버·크론 경로). 세션 MCP를 못 쓰는 정기 배치용.
// 보호: MARKETING_CRON_SECRET 환경변수와 x-cron-secret 헤더 일치 필요.
//
// 사용 예:
//   curl -X POST https://erp.example.com/api/marketing/cron \
//     -H "x-cron-secret: $MARKETING_CRON_SECRET" -H "Content-Type: application/json" \
//     -d '{"reportingMonth":"2026-07-01","configByClient":{"<clientId>":{"keywords":["강남 임플란트"],"target":"myclinic.co.kr","channel":"blog"}}}'

import { NextRequest, NextResponse } from "next/server";
import { runMonthlyPerformanceCollection } from "@/server/marketing/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CronBody = {
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
