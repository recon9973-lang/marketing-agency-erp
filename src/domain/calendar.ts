/**
 * 캘린더 도메인 규칙 (워크플로우 17차).
 * 일정에서 원천(업무·보고서·휴가·거래처)으로 이동하는 링크를 계산한다.
 */

export type CalendarEventLinkSource = {
  workItemId: string | null;
  reportId: string | null;
  leaveRequestId: string | null;
  clientId: string | null;
};

/** 일정이 연결된 원천으로의 딥링크. 없으면 null. 우선순위: 업무 > 보고서 > 휴가 > 거래처. */
export function calendarEventHref(event: CalendarEventLinkSource): string | null {
  if (event.workItemId) return `/work/${event.workItemId}/edit`;
  if (event.reportId) return `/reports/${event.reportId}/edit`;
  if (event.leaveRequestId) return "/leave";
  if (event.clientId) return `/clients/${event.clientId}/ranks`;
  return null;
}
