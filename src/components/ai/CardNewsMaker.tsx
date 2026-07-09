"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImageIcon, Upload } from "lucide-react";

// 카드뉴스 제작 — 이미지에 제목·부제·캡션을 얹어 카드뉴스를 만든다.
// 모두 브라우저 canvas에서 즉시 처리, WebP로 저장. (원고 스튜디오의 도구를 ERP 네이티브로 이식)

type Pos = "top" | "center" | "bottom";
type Tone = "light" | "dark";
type Ratio = "1:1" | "4:5" | "16:9";

const RATIO_SIZE: Record<Ratio, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "16:9": { w: 1080, h: 608 }
};

const chip = (active: boolean) =>
  active
    ? "rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white"
    : "rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 hover:bg-surface";

// 캔버스에 cover-fit 으로 그리기.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height;
  const cr = w / h;
  let dw = w;
  let dh = h;
  let dx = 0;
  let dy = 0;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
    dx = (w - dw) / 2;
  } else {
    dw = w;
    dh = w / ir;
    dy = (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

// 텍스트 줄바꿈.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split("");
  const lines: string[] = [];
  let line = "";
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function CardNewsMaker({ generatedImages }: { generatedImages: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [title, setTitle] = useState("");
  const [sub, setSub] = useState("");
  const [cap, setCap] = useState("");
  const [pos, setPos] = useState<Pos>("bottom");
  const [tone, setTone] = useState<Tone>("light");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [scrim, setScrim] = useState(true);

  const size = RATIO_SIZE[ratio];

  function loadImage(src: string) {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.src = src;
  }

  function onUpload(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  // 입력이 바뀔 때마다 다시 그린다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = size.w;
    canvas.height = size.h;

    // 배경
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, size.w, size.h);
    if (img) drawCover(ctx, img, size.w, size.h);

    const light = tone === "light";
    const textColor = light ? "#ffffff" : "#1a1a1a";
    const pad = Math.round(size.w * 0.07);
    const maxTextW = size.w - pad * 2;

    // 텍스트 블록 높이 계산
    const titleSize = Math.round(size.w * 0.075);
    const subSize = Math.round(size.w * 0.045);
    const capSize = Math.round(size.w * 0.032);

    ctx.textAlign = "left";
    ctx.font = `800 ${titleSize}px Pretendard, 'Malgun Gothic', sans-serif`;
    const titleLines = title ? wrap(ctx, title, maxTextW) : [];
    const lineH = Math.round(titleSize * 1.18);
    const titleBlock = titleLines.length * lineH;
    const subBlock = sub ? Math.round(subSize * 1.5) : 0;
    const capBlock = cap ? Math.round(capSize * 1.8) : 0;
    const totalH = titleBlock + subBlock + capBlock;

    // 위치별 시작 y
    let y: number;
    if (pos === "top") y = pad + titleSize;
    else if (pos === "center") y = (size.h - totalH) / 2 + titleSize;
    else y = size.h - pad - totalH + titleSize;

    // 스크림(가독성 배경)
    if (scrim && (title || sub || cap)) {
      const grad = ctx.createLinearGradient(0, 0, 0, size.h);
      const c = light ? "0,0,0" : "255,255,255";
      if (pos === "bottom") {
        grad.addColorStop(0, `rgba(${c},0)`);
        grad.addColorStop(0.55, `rgba(${c},0)`);
        grad.addColorStop(1, `rgba(${c},0.72)`);
      } else if (pos === "top") {
        grad.addColorStop(0, `rgba(${c},0.72)`);
        grad.addColorStop(0.45, `rgba(${c},0)`);
        grad.addColorStop(1, `rgba(${c},0)`);
      } else {
        grad.addColorStop(0, `rgba(${c},0)`);
        grad.addColorStop(0.5, `rgba(${c},0.6)`);
        grad.addColorStop(1, `rgba(${c},0)`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size.w, size.h);
    }

    // 제목
    ctx.fillStyle = textColor;
    ctx.font = `800 ${titleSize}px Pretendard, 'Malgun Gothic', sans-serif`;
    for (const ln of titleLines) {
      ctx.fillText(ln, pad, y);
      y += lineH;
    }
    // 부제
    if (sub) {
      ctx.font = `600 ${subSize}px Pretendard, 'Malgun Gothic', sans-serif`;
      ctx.fillStyle = light ? "rgba(255,255,255,0.92)" : "rgba(26,26,26,0.9)";
      ctx.fillText(sub, pad, y + Math.round(subSize * 0.2));
      y += subBlock;
    }
    // 캡션
    if (cap) {
      ctx.font = `500 ${capSize}px Pretendard, 'Malgun Gothic', sans-serif`;
      ctx.fillStyle = light ? "rgba(255,255,255,0.75)" : "rgba(26,26,26,0.7)";
      ctx.fillText(cap, pad, y + capSize);
    }
  }, [img, title, sub, cap, pos, tone, ratio, scrim, size.w, size.h]);

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `카드뉴스-${ratio.replace(":", "x")}.webp`;
        a.click();
        URL.revokeObjectURL(url);
      },
      "image/webp",
      0.92
    );
  }

  const hasGenerated = generatedImages.length > 0;
  const inputCls = "w-full rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand";

  const thumbs = useMemo(() => generatedImages.slice(0, 6), [generatedImages]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* 좌: 편집 */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface"
          >
            <Upload className="h-4 w-4" /> 이미지 업로드
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.currentTarget)} />
        </div>

        {hasGenerated ? (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">또는 AI 생성 이미지 사용</p>
            <div className="flex flex-wrap gap-2">
              {thumbs.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt="생성 이미지"
                  onClick={() => loadImage(src)}
                  className="h-14 w-14 cursor-pointer rounded-md border border-line object-cover hover:ring-2 hover:ring-brand"
                />
              ))}
            </div>
          </div>
        ) : null}

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (예: 거북목, 이렇게 풀어요)" className={inputCls} />
        <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="부제 (예: 직장인 5분 루틴)" className={inputCls} />
        <input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="하단 캡션 (예: OO의원 · 카카오 상담)" className={inputCls} />

        <div className="space-y-2 rounded-lg border border-line bg-surface/40 p-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">텍스트 위치</p>
            <div className="flex gap-1.5">
              {(["top", "center", "bottom"] as Pos[]).map((p) => (
                <button key={p} type="button" onClick={() => setPos(p)} className={chip(pos === p)}>
                  {p === "top" ? "상단" : p === "center" ? "중앙" : "하단"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">글자색</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setTone("light")} className={chip(tone === "light")}>밝은 글씨</button>
              <button type="button" onClick={() => setTone("dark")} className={chip(tone === "dark")}>어두운 글씨</button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">비율</p>
            <div className="flex gap-1.5">
              {(["1:1", "4:5", "16:9"] as Ratio[]).map((r) => (
                <button key={r} type="button" onClick={() => setRatio(r)} className={chip(ratio === r)}>{r}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1 text-sm text-slate-600">
            <input type="checkbox" checked={scrim} onChange={(e) => setScrim(e.target.checked)} /> 가독성 배경(스크림)
          </label>
        </div>
      </div>

      {/* 우: 미리보기 */}
      <div className="space-y-3">
        <div className="flex items-center justify-center rounded-xl border border-line bg-surface/40 p-3">
          <canvas ref={canvasRef} className={img ? "max-h-[460px] max-w-full rounded-md" : "hidden"} />
          {!img ? (
            <div className="flex h-64 w-full flex-col items-center justify-center gap-2 text-sm text-slate-400">
              <ImageIcon className="h-8 w-8 text-slate-300" />
              이미지를 올리거나 AI 생성 이미지를 선택하세요.
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={download}
          disabled={!img}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> 카드뉴스 저장 (WebP)
        </button>
      </div>
    </div>
  );
}
