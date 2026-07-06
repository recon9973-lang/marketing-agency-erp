"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type SignaturePadHandle = {
  toDataURL: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
};

/**
 * 태블릿/모바일 서명 패드.
 * - Pointer 이벤트로 마우스·터치·펜을 모두 지원.
 * - touch-action:none 으로 서명 중 화면 스크롤을 막음(태블릿 필수).
 * - devicePixelRatio 보정으로 고해상도에서도 선명한 사인.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number }>(function SignaturePad(
  { height = 200 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#18202f";
  }, [height]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!dirty) setDirty(true);
  }

  function end() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  }

  useImperativeHandle(ref, () => ({
    toDataURL: () => (dirty && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null),
    clear,
    isEmpty: () => !dirty
  }));

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height, touchAction: "none", display: "block", cursor: "crosshair" }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">📱 태블릿에서 손가락/펜으로 위 칸에 서명하세요.</p>
        <button type="button" onClick={clear} className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-surface">
          다시 서명
        </button>
      </div>
    </div>
  );
});
