/**
 * 보고서 알림톡 본문 템플릿 (워크플로우 9차). 순수 함수(테스트 가능).
 * 실제 발송 시 이 text는 승인된 템플릿의 변수 치환 결과와 일치해야 한다.
 */
import type { AlimtalkMessage } from "@/server/integrations/kakao-alimtalk";
import type { ReportEmailData } from "@/server/repositories/reports";

const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });

/** 승인된 알림톡 템플릿 코드(대행사에 등록·승인 필요). */
export const REPORT_READY_TEMPLATE = "report_ready";

export function buildReportAlimtalk(data: ReportEmailData, to: string): AlimtalkMessage {
  const monthLabel = monthFormatter.format(data.reportingMonth);
  const text = [
    `[VENOM 마케팅] ${data.clientName} 님`,
    "",
    `${monthLabel} 마케팅 보고서가 준비되었습니다.`,
    `· 제목: ${data.title}`,
    "",
    "담당자 확인 후 회신 부탁드립니다."
  ].join("\n");

  return { to, templateName: REPORT_READY_TEMPLATE, text };
}
