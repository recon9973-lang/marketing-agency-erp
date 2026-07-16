// 목표 경로: src/server/work/recurrence.ts
//
// 반복 업무 자동 생성(순수 함수) — GEO-OS 설계 §7(주간 운영: 주기 도래 업무 자동 인스턴스화)을
// ERP WorkTemplate.cadenceDays 기반으로 옮긴 것. 스키마 변경 0.
//   시리즈(series) = (거래처 × 템플릿) 짝 + 최신 인스턴스의 생성시각(lastCreatedAt)·담당자.
//   주기(cadenceDays) 도래(now - lastCreatedAt ≥ cadenceDays) 시 새 WorkItem 1건 방출.
//   실행당 시리즈별 최대 1건 — 여러 주기가 밀려 있어도 소급 백필하지 않는다(다음 실행에서 재방출).
//   순수 함수 → DB 없이 오프라인 단위 테스트.

import type { WorkCategory } from "@/domain/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RecurrenceSeries = {
  clientId: string;
  templateId: string;
  ownerId: string;
  title: string;
  category: WorkCategory;
  priority: number;
  cadenceDays: number | null;
  lastCreatedAt: Date;
};

export type DueRecurrence = {
  clientId: string;
  templateId: string;
  ownerId: string;
  title: string;
  category: WorkCategory;
  priority: number;
  dueDate: Date;
};

/**
 * 주기가 도래한 시리즈에 대해 새로 생성할 업무 목록을 반환.
 * 중복 방지: 같은 (clientId, templateId)는 실행당 1건만(seen). 소급 백필 없음(주기당 1건).
 */
export function dueWorkRecurrences(series: RecurrenceSeries[], now: Date): DueRecurrence[] {
  const out: DueRecurrence[] = [];
  const seen = new Set<string>();
  for (const s of series) {
    if (!s.cadenceDays || s.cadenceDays <= 0) continue; // 주기 미설정/비정상은 건너뜀
    const key = `${s.clientId}::${s.templateId}`;
    if (seen.has(key)) continue;
    const daysSince = Math.floor((now.getTime() - s.lastCreatedAt.getTime()) / DAY_MS);
    if (daysSince < s.cadenceDays) continue; // 아직 주기 미도래
    seen.add(key);
    out.push({
      clientId: s.clientId,
      templateId: s.templateId,
      ownerId: s.ownerId,
      title: s.title,
      category: s.category,
      priority: s.priority,
      dueDate: new Date(now.getTime() + s.cadenceDays * DAY_MS)
    });
  }
  return out;
}
