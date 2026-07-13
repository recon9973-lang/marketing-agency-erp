// 이미지 변환 도구 — 에디터 미경유 독립 화면. 다중 파일 → WEBP/JPG/PNG 변환·리사이즈·압축 → ZIP.
// 순수 클라이언트(캔버스) 처리로 서버 왕복 없음. 변환 전/후 용량과 절감률을 보여준다.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, X, Download, ImageDown, Loader2 } from "lucide-react";
import {
  convertImageFile,
  zipBlobs,
  blobToU8,
  downloadBlob,
  humanSize,
  safeName,
  type ImageFormat
} from "@/lib/image-tools";

type Item = {
  id: string;
  file: File;
  originalSize: number;
  out?: { blob: Blob; size: number; width: number; height: number };
  error?: string;
};

const FORMATS: { value: ImageFormat; label: string; ext: string }[] = [
  { value: "webp", label: "WEBP", ext: "webp" },
  { value: "jpeg", label: "JPG", ext: "jpg" },
  { value: "png", label: "PNG", ext: "png" }
];

let seq = 0;

export function ImageConvertTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState(0.8);
  const [maxWidth, setMaxWidth] = useState(0); // 0 = 원본 유지
  const [keepAlpha, setKeepAlpha] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: Item[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      next.push({ id: `f${++seq}`, file: f, originalSize: f.size });
    }
    if (next.length) setItems((prev) => [...prev, ...next]);
  }, []);

  // 옵션/파일 변경 시 자동 변환(디바운스) — 예상 용량 갱신.
  useEffect(() => {
    if (items.length === 0) return;
    setBusy(true);
    const timer = setTimeout(async () => {
      const opts = { format, quality, maxWidth: maxWidth || undefined, keepAlpha };
      const updated = await Promise.all(
        items.map(async (it) => {
          try {
            const r = await convertImageFile(it.file, opts);
            return { ...it, out: { blob: r.blob, size: r.blob.size, width: r.width, height: r.height }, error: undefined };
          } catch (e) {
            return { ...it, out: undefined, error: (e as Error).message };
          }
        })
      );
      setItems(updated);
      setBusy(false);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, format, quality, maxWidth, keepAlpha]);

  const ext = FORMATS.find((f) => f.value === format)?.ext ?? "webp";
  const totalIn = items.reduce((s, i) => s + i.originalSize, 0);
  const totalOut = items.reduce((s, i) => s + (i.out?.size ?? 0), 0);
  const saved = totalIn > 0 && totalOut > 0 ? Math.round((1 - totalOut / totalIn) * 100) : 0;

  async function downloadZip() {
    const ready = items.filter((i) => i.out);
    if (ready.length === 0) return;
    const entries = await Promise.all(
      ready.map(async (i, idx) => ({
        name: `${safeName(i.file.name)}-${String(idx + 1).padStart(2, "0")}.${ext}`,
        data: await blobToU8(i.out!.blob)
      }))
    );
    downloadBlob(zipBlobs(entries), `converted-${ext}.zip`);
  }

  function downloadOne(it: Item) {
    if (it.out) downloadBlob(it.out.blob, `${safeName(it.file.name)}.${ext}`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_18rem]">
      {/* 좌: 드롭존 + 파일 리스트 */}
      <div className="space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
            drag ? "border-brand bg-brand/5" : "border-line bg-card hover:border-brand"
          }`}
        >
          <UploadCloud className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-ink">이미지를 끌어다 놓거나 클릭해 선택</p>
          <p className="text-xs text-slate-400">여러 장 동시 · 브라우저에서 바로 변환(업로드 없음)</p>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>

        {items.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {items.map((it) => {
              const delta = it.out ? Math.round((1 - it.out.size / it.originalSize) * 100) : 0;
              return (
                <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                  <ImageDown className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{it.file.name}</p>
                    <p className="text-xs text-slate-400">
                      {humanSize(it.originalSize)}
                      {it.out ? (
                        <>
                          {" → "}
                          <span className="font-semibold text-emerald-600">{humanSize(it.out.size)}</span>
                          {delta > 0 ? <span className="ml-1 text-emerald-600">-{delta}%</span> : delta < 0 ? <span className="ml-1 text-rose-500">+{-delta}%</span> : null}
                          <span className="ml-1 text-slate-400">· {it.out.width}×{it.out.height}</span>
                        </>
                      ) : it.error ? <span className="ml-1 text-rose-500">{it.error}</span> : <span className="ml-1">변환 중…</span>}
                    </p>
                  </div>
                  <button type="button" onClick={() => downloadOne(it)} disabled={!it.out} className="rounded-md border border-line px-2 py-1 text-xs text-slate-500 hover:border-brand disabled:opacity-40">받기</button>
                  <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} className="rounded-md p-1 text-slate-400 hover:text-rose-500" aria-label="제거"><X className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 우: 옵션 */}
      <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">출력 포맷</p>
          <div className="mt-1.5 flex gap-1">
            {FORMATS.map((f) => (
              <button key={f.value} type="button" onClick={() => setFormat(f.value)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-semibold ${format === f.value ? "border-brand bg-brand/10 text-brand-strong" : "border-line text-slate-500 hover:border-brand"}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {format !== "png" && (
          <label className="block">
            <span className="flex items-center justify-between text-xs font-semibold text-slate-500">품질 <span className="tabular-nums text-slate-400">{Math.round(quality * 100)}%</span></span>
            <input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="mt-1 w-full accent-brand" />
          </label>
        )}

        <label className="block">
          <span className="text-xs font-semibold text-slate-500">가로 최대폭(px) · 0=원본</span>
          <input type="number" min={0} step={100} value={maxWidth} onChange={(e) => setMaxWidth(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm text-ink" />
        </label>

        {format !== "jpeg" && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={keepAlpha} onChange={(e) => setKeepAlpha(e.target.checked)} /> 투명 배경 유지
          </label>
        )}

        <div className="rounded-lg bg-surface px-3 py-2 text-xs text-slate-500">
          <div className="flex justify-between"><span>파일</span><span className="tabular-nums text-ink">{items.length}장</span></div>
          <div className="flex justify-between"><span>원본 합계</span><span className="tabular-nums">{humanSize(totalIn)}</span></div>
          <div className="flex justify-between"><span>변환 합계</span><span className="tabular-nums font-semibold text-emerald-600">{humanSize(totalOut)}{saved > 0 ? ` (-${saved}%)` : ""}</span></div>
        </div>

        <button type="button" onClick={downloadZip} disabled={busy || items.every((i) => !i.out)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} 전체 ZIP 다운로드
        </button>
      </div>
    </div>
  );
}
