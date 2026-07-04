/**
 * 보고서 메일 본문 템플릿 (워크플로우 8차).
 * 순수 함수로 두어 단위 테스트가 가능하고, "use server" 제약을 받지 않는다.
 */
import type { EmailMessage } from "@/server/integrations/email";
import type { ReportEmailData } from "@/server/repositories/reports";

const monthFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 보고서 데이터로 메일 본문(제목/HTML/텍스트)을 만든다. */
export function buildReportEmail(data: ReportEmailData, to: string): EmailMessage {
  const monthLabel = monthFormatter.format(data.reportingMonth);
  const subject = `[${data.clientName}] ${monthLabel} 마케팅 보고서 · ${data.title}`;

  const metricsRows =
    data.metrics.length > 0
      ? data.metrics
          .map(
            (metric) =>
              `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;color:#555">${escapeHtml(
                metric.label
              )}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-weight:600;text-align:right">${escapeHtml(
                metric.value
              )}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="2" style="padding:6px 12px;color:#999">성과 지표 미입력</td></tr>`;

  const notesBlock = data.notes
    ? `<p style="margin:16px 0 0;white-space:pre-wrap;line-height:1.6;color:#333">${escapeHtml(data.notes)}</p>`
    : "";

  const html = `<div style="font-family:Apple SD Gothic Neo,Malgun Gothic,sans-serif;max-width:560px;margin:0 auto;color:#18202f">
  <div style="border-bottom:3px solid #1f7a68;padding-bottom:12px;margin-bottom:16px">
    <p style="margin:0;font-size:12px;letter-spacing:1px;color:#1f7a68;font-weight:700">VENOM 마케팅</p>
    <h1 style="margin:6px 0 0;font-size:20px">${escapeHtml(data.title)}</h1>
    <p style="margin:4px 0 0;color:#777;font-size:13px">${escapeHtml(data.clientName)} · ${escapeHtml(monthLabel)}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${metricsRows}</table>
  ${notesBlock}
  <p style="margin:24px 0 0;font-size:12px;color:#aaa">본 메일은 VENOM ERP에서 발송되었습니다.</p>
</div>`;

  const text = [
    `${data.clientName} · ${monthLabel} 마케팅 보고서`,
    data.title,
    "",
    ...data.metrics.map((metric) => `- ${metric.label}: ${metric.value}`),
    data.notes ? `\n${data.notes}` : ""
  ].join("\n");

  return { to, subject, html, text };
}
