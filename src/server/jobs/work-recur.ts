// 목표 경로: src/server/jobs/work-recur.ts
//
// 반복 업무 자동 생성(배치) — active·cadenceDays 설정된 WorkTemplate에 대해,
// (거래처×템플릿)별 최신 인스턴스를 앵커로 주기 도래분을 새 WorkItem으로 생성.
// 판정은 순수 함수(dueWorkRecurrences)에 위임하고, 여기서는 조회/기록만 담당.
// 멱등: 방금 만든 인스턴스가 다음 조회에서 최신 앵커가 되므로 같은 날 재호출해도 중복 생성 안 함.
// 규모 상한(템플릿 수 × 거래처 수)이라 조인 후 메모리 축약으로 충분.

import { WorkStatus, type WorkCategory } from "@/domain/types";
import { db } from "@/server/db";
import { dueWorkRecurrences, type RecurrenceSeries } from "@/server/work/recurrence";

export type WorkRecurrenceResult = { templates: number; series: number; created: number };

export async function runWorkRecurrence(now = new Date()): Promise<WorkRecurrenceResult> {
  const result: WorkRecurrenceResult = { templates: 0, series: 0, created: 0 };

  const templates = await db.workTemplate.findMany({
    where: { active: true, cadenceDays: { not: null, gt: 0 } },
    select: { id: true, title: true, category: true, defaultPriority: true, cadenceDays: true }
  });
  result.templates = templates.length;
  if (templates.length === 0) return result;

  const templateIds = templates.map((t) => t.id);
  const tmplById = new Map(templates.map((t) => [t.id, t]));

  // 템플릿 기반 기존 업무 — desc 정렬 후 (거래처×템플릿)별 첫 건(=최신)만 시리즈 앵커로 사용
  const items = await db.workItem.findMany({
    where: { templateId: { in: templateIds } },
    orderBy: { createdAt: "desc" },
    select: { clientId: true, templateId: true, ownerId: true, createdAt: true }
  });

  const series: RecurrenceSeries[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!it.templateId) continue;
    const key = `${it.clientId}::${it.templateId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = tmplById.get(it.templateId);
    if (!t) continue;
    series.push({
      clientId: it.clientId,
      templateId: it.templateId,
      ownerId: it.ownerId,
      title: t.title,
      category: t.category as WorkCategory,
      priority: t.defaultPriority,
      cadenceDays: t.cadenceDays,
      lastCreatedAt: it.createdAt
    });
  }
  result.series = series.length;

  const due = dueWorkRecurrences(series, now);
  if (due.length === 0) return result;

  await db.workItem.createMany({
    data: due.map((d) => ({
      clientId: d.clientId,
      templateId: d.templateId,
      ownerId: d.ownerId,
      title: d.title,
      category: d.category,
      priority: d.priority,
      status: WorkStatus.NOT_STARTED,
      dueDate: d.dueDate
    }))
  });
  result.created = due.length;

  return result;
}
