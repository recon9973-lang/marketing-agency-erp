// 목표 경로: src/components/magazine/cover.ts
//
// 매거진 커버 자동 생성 — 브라우저 Canvas로 온브랜드 대표이미지(1200×630 OG)를 만든다.
// 서버 래스터라이저(sharp/resvg 등)가 없고 워드프레스는 SVG 업로드를 기본 차단하므로,
// 클라이언트에서 결정적·무료로 PNG를 뽑아 발행 시 서버가 대표이미지로 업로드한다.

const W = 1200;
const H = 630;
const BRAND = "#d9662e"; // ㈜베놈 오렌지
const BRAND_SOFT = "#f7e2d5";
const INK = "#0f172a";
const SUB = "#64748b";
const FONT_STACK = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";

export type CoverInput = { title: string; category: string; kindLabel: string };

/** 제목을 최대 줄 수에 맞춰 배치(한글은 글자 단위 줄바꿈). 넘치면 마지막 줄 말줄임. */
function layoutTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): { lines: string[]; truncated: boolean } {
  const chars = Array.from(text.trim());
  const lines: string[] = [];
  let line = "";
  let i = 0;
  for (; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "\n") {
      lines.push(line);
      line = "";
      if (lines.length === maxLines) break;
      continue;
    }
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length === maxLines) {
        line = "";
        break;
      }
    } else {
      line += ch;
    }
  }
  if (line && lines.length < maxLines) {
    lines.push(line);
    i = chars.length;
  }
  const truncated = i < chars.length;
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = last + "…";
  }
  return { lines, truncated };
}

/** 제목 길이에 맞춰 폰트 크기 자동 선택(넘치지 않는 가장 큰 크기). */
function fitTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const maxLines = 4;
  for (const size of [80, 72, 64, 56, 50]) {
    ctx.font = `800 ${size}px ${FONT_STACK}`;
    const { lines, truncated } = layoutTitle(ctx, text, maxWidth, maxLines);
    if (!truncated) return { lines, size };
  }
  ctx.font = `800 50px ${FONT_STACK}`;
  const { lines } = layoutTitle(ctx, text, maxWidth, maxLines);
  return { lines, size: 50 };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 브랜드 커버 PNG(data URL)를 생성한다. 실패 시 빈 문자열.
 * 웹폰트 로드를 기다린 뒤 그려 한글/폰트 지표가 정확하도록 한다.
 */
export async function renderMagazineCover(input: CoverInput): Promise<string> {
  if (typeof document === "undefined") return "";
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* 폰트 대기 실패는 무시(폴백 폰트로 진행) */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // 배경
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // 우하단 브랜드 스플래시(부드러운 원)
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = BRAND_SOFT;
  ctx.beginPath();
  ctx.arc(W - 40, H + 60, 320, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.arc(W - 90, H - 70, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 상단 브랜드 바
  ctx.fillStyle = BRAND;
  ctx.fillRect(0, 0, W, 12);

  const padX = 84;

  // 워드마크(로고 사각 + 텍스트)
  ctx.fillStyle = BRAND;
  roundRect(ctx, padX, 74, 40, 40, 10);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 22px ${FONT_STACK}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("G", padX + 20, 96);
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `800 24px ${FONT_STACK}`;
  ctx.fillText("GROUND", padX + 56, 88);
  ctx.fillStyle = SUB;
  ctx.font = `600 15px ${FONT_STACK}`;
  ctx.fillText("㈜베놈 · 매거진", padX + 56, 108);

  // 카테고리 eyebrow(오렌지 점 + 라벨)
  const eyebrowY = 232;
  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.arc(padX + 7, eyebrowY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `700 26px ${FONT_STACK}`;
  ctx.textBaseline = "middle";
  ctx.fillText(input.category, padX + 26, eyebrowY + 1);

  // 제목(자동 크기·줄바꿈)
  const maxWidth = W - padX * 2 - 40;
  const { lines, size } = fitTitle(ctx, input.title || "제목 없음", maxWidth);
  const lineHeight = Math.round(size * 1.24);
  ctx.fillStyle = INK;
  ctx.font = `800 ${size}px ${FONT_STACK}`;
  ctx.textBaseline = "alphabetic";
  let ty = 300 + size;
  for (const ln of lines) {
    ctx.fillText(ln, padX, ty);
    ty += lineHeight;
  }

  // 하단: 유형 칩 + 도메인
  const chipY = H - 78;
  ctx.font = `700 18px ${FONT_STACK}`;
  const chipLabel = input.kindLabel || "아티클";
  const chipW = ctx.measureText(chipLabel).width + 34;
  ctx.fillStyle = BRAND_SOFT;
  roundRect(ctx, padX, chipY, chipW, 38, 19);
  ctx.fill();
  ctx.fillStyle = BRAND;
  ctx.textBaseline = "middle";
  ctx.fillText(chipLabel, padX + 17, chipY + 20);
  ctx.fillStyle = SUB;
  ctx.font = `600 18px ${FONT_STACK}`;
  ctx.fillText("seokorea.org", padX + chipW + 16, chipY + 20);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}
