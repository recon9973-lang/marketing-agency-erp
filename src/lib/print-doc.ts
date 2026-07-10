// 목표 경로: src/lib/print-doc.ts
//
// 클라이언트에서 깨끗한 문서 HTML을 새 창에 열어 인쇄(PDF 저장)한다. 의존성 없음.

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Pretendard','Malgun Gothic',sans-serif; color: #1a1c20; padding: 40px; font-size: 13px; line-height: 1.7; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; color: #c2560f; border-bottom: 2px solid #fbeadd; padding-bottom: 4px; }
  .eyebrow { color: #c2560f; font-weight: 700; font-size: 12px; }
  .muted { color: #6b7280; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #e8e7e4; padding: 6px 8px; text-align: left; font-size: 12px; }
  th { background: #f6f5f3; }
  .total { font-weight: 700; color: #c2560f; }
  .chip { display: inline-block; background: #fbeadd; color: #c2560f; border-radius: 999px; padding: 1px 8px; font-size: 11px; }
  .tier { border: 1px solid #e8e7e4; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  @media print { body { padding: 16px; } }
`;

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

/** 제목 + 본문 HTML을 새 창에 열어 인쇄. innerHtml은 신뢰되는(직접 구성한) 문자열만. */
export function printDocument(title: string, innerHtml: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${BASE_CSS}</style></head><body>${innerHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
