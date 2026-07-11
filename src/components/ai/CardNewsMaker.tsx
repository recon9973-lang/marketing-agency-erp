"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon, Layers, Plus, Square, Trash2, Type, Upload } from "lucide-react";

// 카드뉴스 에디터(미리캔버스/망고보드 형태) — 배경 위에 텍스트·박스 요소를 자유 배치·편집.
// 편집은 DOM(드래그/선택), 내보내기는 요소 상태를 캔버스에 렌더 → WebP 다운로드. 의존성 없음.

type Ratio = "1:1" | "4:5" | "16:9";
const RATIO_SIZE: Record<Ratio, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "16:9": { w: 1080, h: 608 }
};

type TextEl = { id: string; kind: "text"; x: number; y: number; w: number; text: string; size: number; color: string; weight: number; align: "left" | "center" | "right" };
type BoxEl = { id: string; kind: "box"; x: number; y: number; w: number; h: number; color: string; radius: number };
type El = TextEl | BoxEl;

const uid = () => Math.random().toString(36).slice(2, 9);
const PALETTE = ["#ffffff", "#1a1c20", "#d9662e", "#c2560f", "#2f7d6b", "#e11d48", "#2563eb", "#f59e0b"];

// 시작 템플릿.
function template(name: string, W: number, H: number): El[] {
  if (name === "notice")
    return [
      { id: uid(), kind: "box", x: W * 0.08, y: H * 0.62, w: W * 0.84, h: H * 0.3, color: "rgba(0,0,0,0.55)", radius: 24 },
      { id: uid(), kind: "text", x: W * 0.12, y: H * 0.66, w: W * 0.76, text: "여름철 피부 관리", size: 84, color: "#ffffff", weight: 800, align: "left" },
      { id: uid(), kind: "text", x: W * 0.12, y: H * 0.8, w: W * 0.76, text: "OO의원 · 카카오 상담", size: 40, color: "#ffffff", weight: 500, align: "left" }
    ];
  if (name === "quote")
    return [
      { id: uid(), kind: "text", x: W * 0.1, y: H * 0.38, w: W * 0.8, text: "“건강한 피부의 시작”", size: 92, color: "#ffffff", weight: 800, align: "center" },
      { id: uid(), kind: "text", x: W * 0.1, y: H * 0.56, w: W * 0.8, text: "전문의가 함께합니다", size: 44, color: "#ffffff", weight: 500, align: "center" }
    ];
  // title (기본)
  return [
    { id: uid(), kind: "text", x: W * 0.1, y: H * 0.1, w: W * 0.8, text: "제목을 입력하세요", size: 88, color: "#ffffff", weight: 800, align: "left" },
    { id: uid(), kind: "text", x: W * 0.1, y: H * 0.24, w: W * 0.8, text: "부제·설명을 입력", size: 46, color: "#ffffff", weight: 500, align: "left" }
  ];
}

// 캔버스 텍스트 줄바꿈.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else line = line + ch;
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function CardNewsMaker({ generatedImages }: { generatedImages: string[] }) {
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const size = RATIO_SIZE[ratio];
  const [bgColor, setBgColor] = useState("#111827");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [els, setEls] = useState<El[]>(() => template("title", RATIO_SIZE["1:1"].w, RATIO_SIZE["1:1"].h));
  const [selId, setSelId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; scale: number } | null>(null);

  // 표시 스케일: 디자인 폭(1080) → CSS 폭.
  const [cssW, setCssW] = useState(420);
  useEffect(() => {
    const el = stageRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setCssW(Math.min(460, el.clientWidth - 4)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = cssW / size.w;

  const sel = els.find((e) => e.id === selId) ?? null;
  const update = (id: string, patch: Partial<TextEl> & Partial<BoxEl>) => setEls((prev) => prev.map((e) => (e.id === id ? ({ ...e, ...patch } as El) : e)));
  const remove = (id: string) => { setEls((prev) => prev.filter((e) => e.id !== id)); setSelId(null); };
  const bringFront = (id: string) => setEls((prev) => { const t = prev.find((e) => e.id === id); return t ? [...prev.filter((e) => e.id !== id), t] : prev; });

  function addText() {
    const e: TextEl = { id: uid(), kind: "text", x: size.w * 0.15, y: size.h * 0.45, w: size.w * 0.7, text: "텍스트", size: 60, color: "#ffffff", weight: 700, align: "center" };
    setEls((p) => [...p, e]); setSelId(e.id);
  }
  function addBox() {
    const e: BoxEl = { id: uid(), kind: "box", x: size.w * 0.2, y: size.h * 0.4, w: size.w * 0.6, h: size.h * 0.2, color: "rgba(217,102,46,0.85)", radius: 20 };
    setEls((p) => [...p, e]); setSelId(e.id);
  }

  // 드래그
  function onPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    setSelId(id);
    const t = els.find((x) => x.id === id);
    if (!t) return;
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, scale };
  }
  useEffect(() => {
    function move(ev: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const nx = d.ox + (ev.clientX - d.sx) / d.scale;
      const ny = d.oy + (ev.clientY - d.sy) / d.scale;
      update(d.id, { x: Math.max(-size.w * 0.2, Math.min(size.w * 1.1, nx)), y: Math.max(-size.h * 0.1, Math.min(size.h * 1.05, ny)) });
    }
    function up() { drag.current = null; }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [size.w, size.h]);

  function onUpload(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setBgImage(String(r.result));
    r.readAsDataURL(f);
  }

  // 내보내기 — 요소 상태를 캔버스에 렌더.
  function exportImage() {
    const canvas = document.createElement("canvas");
    canvas.width = size.w; canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, size.w, size.h);
    const draw = () => {
      for (const e of els) {
        if (e.kind === "box") { ctx.fillStyle = e.color; roundRect(ctx, e.x, e.y, e.w, e.h, e.radius); ctx.fill(); }
        else {
          ctx.fillStyle = e.color;
          ctx.textAlign = e.align;
          ctx.textBaseline = "top";
          ctx.font = `${e.weight} ${e.size}px Pretendard, 'Malgun Gothic', sans-serif`;
          const lines = wrapText(ctx, e.text, e.w);
          const ax = e.align === "center" ? e.x + e.w / 2 : e.align === "right" ? e.x + e.w : e.x;
          let y = e.y;
          for (const ln of lines) { ctx.fillText(ln, ax, y); y += e.size * 1.2; }
        }
      }
      canvas.toBlob((b) => {
        if (!b) return;
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url; a.download = `카드뉴스-${ratio.replace(":", "x")}.webp`; a.click();
        URL.revokeObjectURL(url);
      }, "image/webp", 0.92);
    };
    if (bgImage) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const ir = img.width / img.height, cr = size.w / size.h;
        let dw = size.w, dh = size.h, dx = 0, dy = 0;
        if (ir > cr) { dh = size.h; dw = size.h * ir; dx = (size.w - dw) / 2; } else { dw = size.w; dh = size.w / ir; dy = (size.h - dh) / 2; }
        ctx.drawImage(img, dx, dy, dw, dh);
        draw();
      };
      img.src = bgImage;
    } else draw();
  }

  const inputCls = "w-full rounded-md border border-line px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand";
  const stageH = size.h * scale;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      {/* 좌: 스테이지 + 툴바 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={addText} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white"><Type className="h-4 w-4" /> 텍스트</button>
          <button type="button" onClick={addBox} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface"><Square className="h-4 w-4" /> 박스</button>
          <select onChange={(e) => { if (e.target.value) { setEls(template(e.target.value, size.w, size.h)); setSelId(null); e.target.value = ""; } }} defaultValue="" className="rounded-md border border-line px-2.5 py-2 text-sm text-slate-700">
            <option value="">템플릿</option>
            <option value="title">제목형</option>
            <option value="notice">공지형</option>
            <option value="quote">인용형</option>
          </select>
          <div className="ml-auto flex gap-1">
            {(["1:1", "4:5", "16:9"] as Ratio[]).map((r) => (
              <button key={r} type="button" onClick={() => setRatio(r)} className={r === ratio ? "rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white" : "rounded-full border border-line bg-white px-3 py-1 text-xs text-slate-600 hover:bg-surface"}>{r}</button>
            ))}
          </div>
        </div>

        <div className="flex justify-center rounded-xl border border-line bg-surface/40 p-3">
          <div
            ref={stageRef}
            onPointerDown={() => setSelId(null)}
            className="relative overflow-hidden rounded-md shadow-sm"
            style={{ width: cssW, height: stageH, background: bgColor }}
          >
            {bgImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bgImage} alt="배경" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
            ) : null}
            {els.map((e) => (
              <div
                key={e.id}
                onPointerDown={(ev) => onPointerDown(ev, e.id)}
                className={"absolute cursor-move select-none " + (selId === e.id ? "outline outline-2 outline-brand" : "")}
                style={{ left: e.x * scale, top: e.y * scale, width: (e.kind === "box" ? e.w : e.w) * scale, height: e.kind === "box" ? e.h * scale : undefined }}
              >
                {e.kind === "box" ? (
                  <div style={{ width: "100%", height: "100%", background: e.color, borderRadius: e.radius * scale }} />
                ) : (
                  <div style={{ color: e.color, fontSize: e.size * scale, fontWeight: e.weight, textAlign: e.align, lineHeight: 1.2, fontFamily: "Pretendard, 'Malgun Gothic', sans-serif", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{e.text}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button type="button" onClick={exportImage} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"><Download className="h-4 w-4" /> 카드뉴스 저장 (WebP)</button>
      </div>

      {/* 우: 속성 패널 */}
      <div className="space-y-4">
        {/* 배경 */}
        <div className="rounded-2xl border border-line bg-white p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500"><ImageIcon className="h-3.5 w-3.5" /> 배경</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => <button key={c} type="button" onClick={() => { setBgColor(c); setBgImage(null); }} className="h-6 w-6 rounded-full border border-line" style={{ background: c }} />)}
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface"><Upload className="h-3.5 w-3.5" /> 이미지</button>
            {bgImage ? <button type="button" onClick={() => setBgImage(null)} className="rounded-md border border-line px-2.5 py-1.5 text-xs text-slate-500 hover:bg-surface">제거</button> : null}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.currentTarget)} />
          </div>
          {generatedImages.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {generatedImages.slice(0, 6).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="AI" onClick={() => setBgImage(src)} className="h-10 w-10 cursor-pointer rounded border border-line object-cover hover:ring-2 hover:ring-brand" />
              ))}
            </div>
          ) : null}
        </div>

        {/* 선택 요소 속성 */}
        {sel ? (
          <div className="rounded-2xl border border-line bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500">{sel.kind === "text" ? "텍스트 속성" : "박스 속성"}</p>
              <div className="flex gap-1">
                <button type="button" onClick={() => bringFront(sel.id)} className="text-slate-400 hover:text-brand-strong" aria-label="맨 앞으로"><Layers className="h-4 w-4" /></button>
                <button type="button" onClick={() => remove(sel.id)} className="text-slate-400 hover:text-danger" aria-label="삭제"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {sel.kind === "text" ? (
              <div className="space-y-2">
                <textarea value={sel.text} onChange={(e) => update(sel.id, { text: e.target.value })} rows={2} className={inputCls} />
                <label className="block text-xs text-slate-500">크기 {Math.round(sel.size)}
                  <input type="range" min={24} max={180} value={sel.size} onChange={(e) => update(sel.id, { size: Number(e.target.value) })} className="w-full" />
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1">{PALETTE.map((c) => <button key={c} type="button" onClick={() => update(sel.id, { color: c })} className="h-5 w-5 rounded-full border border-line" style={{ background: c }} />)}</div>
                </div>
                <div className="flex gap-1">
                  {([["left", "좌"], ["center", "중"], ["right", "우"]] as const).map(([a, l]) => (
                    <button key={a} type="button" onClick={() => update(sel.id, { align: a })} className={sel.align === a ? "rounded bg-brand px-2 py-1 text-xs text-white" : "rounded border border-line px-2 py-1 text-xs text-slate-600"}>{l}</button>
                  ))}
                  <button type="button" onClick={() => update(sel.id, { weight: sel.weight >= 700 ? 400 : 800 })} className={sel.weight >= 700 ? "rounded bg-brand px-2 py-1 text-xs font-bold text-white" : "rounded border border-line px-2 py-1 text-xs font-bold text-slate-600"}>B</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">{["rgba(217,102,46,0.85)", "rgba(0,0,0,0.55)", "rgba(255,255,255,0.9)", "#d9662e", "#1a1c20"].map((c) => <button key={c} type="button" onClick={() => update(sel.id, { color: c })} className="h-6 w-6 rounded border border-line" style={{ background: c }} />)}</div>
                <label className="block text-xs text-slate-500">너비<input type="range" min={size.w * 0.1} max={size.w} value={sel.w} onChange={(e) => update(sel.id, { w: Number(e.target.value) })} className="w-full" /></label>
                <label className="block text-xs text-slate-500">높이<input type="range" min={size.h * 0.05} max={size.h} value={sel.h} onChange={(e) => update(sel.id, { h: Number(e.target.value) })} className="w-full" /></label>
                <label className="block text-xs text-slate-500">모서리<input type="range" min={0} max={80} value={sel.radius} onChange={(e) => update(sel.id, { radius: Number(e.target.value) })} className="w-full" /></label>
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-line bg-surface/40 px-3 py-6 text-center text-xs text-slate-400">
            <Plus className="mx-auto mb-1 h-4 w-4" />
            요소를 클릭해 편집하거나, 위에서 텍스트·박스를 추가하세요. 드래그로 위치를 옮깁니다.
          </p>
        )}
      </div>
    </div>
  );
}
