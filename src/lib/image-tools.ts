// 브라우저 이미지 유틸 — 변환/리사이즈/ZIP/다운로드. 디자인 스튜디오 내보내기와 변환 도구가 공유.
// 순수 클라이언트(캔버스·Blob) — 서버 왕복 없음.
"use client";

import { zipSync } from "fflate";

export type ImageFormat = "webp" | "jpeg" | "png";

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 파일명에서 안전한 슬러그(한글 허용) + 확장자 교체용. */
export function safeName(name: string): string {
  return (name || "image").replace(/\.[^.]+$/, "").replace(/[^\w가-힣-]+/g, "_") || "image";
}

/** dataURL → Uint8Array (ZIP/파일 바이트). */
export function dataUrlToU8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(base64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export async function blobToU8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** 여러 바이트 묶음을 ZIP Blob으로. 이름 중복 시 뒤에 -2, -3… 부여. */
export function zipBlobs(entries: { name: string; data: Uint8Array }[]): Blob {
  const files: Record<string, Uint8Array> = {};
  const used = new Map<string, number>();
  for (const e of entries) {
    let name = e.name;
    if (files[name]) {
      const n = (used.get(e.name) ?? 1) + 1;
      used.set(e.name, n);
      const dot = e.name.lastIndexOf(".");
      name = dot > 0 ? `${e.name.slice(0, dot)}-${n}${e.name.slice(dot)}` : `${e.name}-${n}`;
    }
    files[name] = e.data;
  }
  return new Blob([zipSync(files)], { type: "application/zip" });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = src;
  });
}

export type ConvertOptions = {
  format: ImageFormat;
  quality: number; // 0~1 (png은 무시)
  maxWidth?: number; // 리사이즈 상한(비율 유지), 없으면 원본
  keepAlpha: boolean; // false면 흰 배경 합성(jpeg는 항상 합성)
};

export type ConvertResult = { blob: Blob; width: number; height: number };

/** File(이미지) → 지정 포맷/품질/리사이즈로 변환한 Blob. */
export async function convertImageFile(file: File, opts: ConvertOptions): Promise<ConvertResult> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const ratio = opts.maxWidth && srcW > opts.maxWidth ? opts.maxWidth / srcW : 1;
    const width = Math.max(1, Math.round(srcW * ratio));
    const height = Math.max(1, Math.round(srcH * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스를 사용할 수 없습니다.");
    const flatten = opts.format === "jpeg" || !opts.keepAlpha;
    if (flatten) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    const mime = `image/${opts.format}`;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("변환에 실패했습니다."))), mime, opts.quality)
    );
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
