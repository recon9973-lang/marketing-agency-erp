// 이미지 변환·최적화 도구 — 에디터 없이 브라우저에서 PNG/JPG/WEBP 변환·압축·리사이즈.
// 전 과정 클라이언트 처리(canvas.toBlob) — 서버 왕복·업로드 없음(프라이버시·비용 0).
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { zipSync } from "fflate";
import { UploadCloud, Download, X, Loader2, ImageDown, ArrowRight } from "lucide-react";

type Format = "webp" | "jpeg" | "png";
type Item = {
  id: string;
  file: File;
  previewUrl: string;
  inSize: number;
  status: "idle" | "working" | "done" | "error";
  outBlob?: Blob;
  outUrl?: string;
  outSize?: number;
  outName?: string;
  outW?: number;
  outH?: number;
};

const EXT: Record<Format, string> = { webp: "webp", jpeg: "jpg", png: "png" };

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

let idSeq = 0;
function newId() {
  idSeq += 1;
  return `f${idSeq}`;
}

async function convert(file: File, opts: { format: Format; quality: number; maxWidth: number | null; keepAlpha: boolean }) {
  const bitmap = await createImageBitmap(file);
  let tw = bitmap.width;
  let th = bitmap.height;
  if (opts.maxWidth && tw > opts.maxWidth) {
    th = Math.round((th * opts.maxWidth) / tw);
    tw = opts.maxWidth;
  }
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  // JPG는 투명도 미지원, 투명 유지 해제 시에도 흰 배경으로 평탄화.
  const flatten = opts.format === "jpeg" || !opts.keepAlpha;
  if (flatten) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tw, th);
  }
  ctx.drawImage(bitmap, 0, 0, tw, th);
  bitmap.close?.();
  const mime = `image/${opts.format}`;
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, opts.quality));
  if (!blob) throw new Error("toBlob");
  return { blob, w: tw, h: th };
}

export function ImageConverter() {
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<Format>("webp");
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState<string>("");
  const [keepAlpha, setKeepAlpha] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setItems((prev) => [
      ...prev,
      ...imgs.map((file) => ({ id: newId(), file, previewUrl: URL.createObjectURL(file), inSize: file.size, status: "idle" as const }))
    ]);
  }, []);

  function removeItem(id: string) {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) {
        URL.revokeObjectURL(it.previewUrl);
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }
  function clearAll() {
    items.forEach((i) => {
      URL.revokeObjectURL(i.previewUrl);
      if (i.outUrl) URL.revokeObjectURL(i.outUrl);
    });
    setItems([]);
  }

  const opts = useMemo(
    () => ({ format, quality, maxWidth: maxWidth ? Math.max(1, Number(maxWidth)) || null : null, keepAlpha }),
    [format, quality, maxWidth, keepAlpha]
  );

  async function runAll() {
    setBusy(true);
    // 순차 처리 — 대량 파일에서 메모리 급증 방지.
    for (const item of items) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "working" } : i)));
      try {
        const { blob, w, h } = await convert(item.file, opts);
        const base = item.file.name.replace(/\.[^.]+$/, "");
        const outName = `${base}.${EXT[opts.format]}`;
        const outUrl = URL.createObjectURL(blob);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "done", outBlob: blob, outUrl, outSize: blob.size, outName, outW: w, outH: h }
              : i
          )
        );
      } catch {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "error" } : i)));
      }
    }
    setBusy(false);
  }

  function downloadOne(item: Item) {
    if (!item.outUrl || !item.outName) return;
    const a = document.createElement("a");
    a.href = item.outUrl;
    a.download = item.outName;
    a.click();
  }

  function downloadZip() {
    const done = items.filter((i) => i.status === "done" && i.outBlob && i.outName);
    if (!done.length) return;
    Promise.all(
      done.map(async (i, idx) => {
        const buf = new Uint8Array(await i.outBlob!.arrayBuffer());
        // 파일명 충돌 방지 — 중복 시 순번 접두.
        const name = done.filter((d, j) => j < idx && d.outName === i.outName).length ? `${idx + 1}_${i.outName}` : i.outName!;
        return [name, buf] as const;
      })
    ).then((entries) => {
      const zipped = zipSync(Object.fromEntries(entries), { level: 0 });
      const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `images-${opts.format}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  }

  const doneItems = items.filter((i) => i.status === "done");
  const totalIn = doneItems.reduce((s, i) => s + i.inSize, 0);
  const totalOut = doneItems.reduce((s, i) => s + (i.outSize ?? 0), 0);
  const savings = totalIn > 0 ? Math.round((1 - totalOut / totalIn) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* 드롭존 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${dragOver ? "border-brand bg-brand/5" : "border-line bg-card hover:border-brand"}`}
      >
        <UploadCloud className="h-8 w-8 text-brand" />
        <p className="text-sm font-medium text-ink">이미지를 드래그하거나 클릭해 올리세요</p>
        <p className="text-xs text-slate-400">여러 장 한 번에 · 브라우저에서 바로 변환(서버 업로드 없음)</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* 옵션 */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">포맷</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)}
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand">
            <option value="webp">WEBP</option>
            <option value="jpeg">JPG</option>
            <option value="png">PNG</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">
            품질 {format === "png" ? "(PNG 무손실)" : `${Math.round(quality * 100)}%`}
          </span>
          <input type="range" min={0.1} max={1} step={0.05} value={quality} disabled={format === "png"}
            onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-brand disabled:opacity-40" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">최대 너비(px)</span>
          <input type="number" value={maxWidth} placeholder="원본 유지" min={1}
            onChange={(e) => setMaxWidth(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand" />
        </label>
        <label className="flex items-end gap-1.5 pb-1.5 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={keepAlpha} disabled={format === "jpeg"}
            onChange={(e) => setKeepAlpha(e.target.checked)} className="accent-brand disabled:opacity-40" />
          투명 배경 유지
        </label>
      </div>

      {/* 액션 */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={runAll} disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />} 변환 ({items.length})
          </button>
          <button type="button" onClick={downloadZip} disabled={doneItems.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:border-brand disabled:opacity-40">
            <Download className="h-4 w-4" /> ZIP 다운로드
          </button>
          <button type="button" onClick={clearAll} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-red-500">전체 지우기</button>
          {doneItems.length > 0 && (
            <span className="ml-auto text-sm text-slate-500">
              {humanSize(totalIn)} → <span className="font-semibold text-ink">{humanSize(totalOut)}</span>
              {savings > 0 && <span className="ml-1 font-semibold text-green-600">-{savings}%</span>}
            </span>
          )}
        </div>
      )}

      {/* 파일 리스트 */}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line">
          {items.map((i) => {
            const pct = i.outSize ? Math.round((1 - i.outSize / i.inSize) * 100) : 0;
            return (
              <div key={i.id} className="flex items-center gap-3 border-b border-line bg-card px-3 py-2 last:border-b-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.previewUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{i.outName ?? i.file.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400">
                    {humanSize(i.inSize)}
                    {i.status === "done" && i.outSize != null && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-ink">{humanSize(i.outSize)}</span>
                        {pct > 0 && <span className="font-semibold text-green-600">-{pct}%</span>}
                        {i.outW && <span className="text-slate-400">· {i.outW}×{i.outH}</span>}
                      </>
                    )}
                    {i.status === "error" && <span className="text-red-500">변환 실패</span>}
                  </p>
                </div>
                {i.status === "working" && <Loader2 className="h-4 w-4 animate-spin text-brand" />}
                {i.status === "done" && (
                  <button type="button" onClick={() => downloadOne(i)} className="rounded-lg border border-line p-1.5 text-slate-500 hover:border-brand hover:text-brand" aria-label="다운로드">
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={() => removeItem(i.id)} className="rounded-lg p-1.5 text-slate-400 hover:text-red-500" aria-label="제거">
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
