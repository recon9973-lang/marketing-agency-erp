// 디자인 스튜디오 에디터 — 문서 상태·패널·툴바·자동저장·내보내기 오케스트레이션.
// 캔버스(react-konva)는 브라우저 전용이라 ssr:false로 동적 로드한다.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type Konva from "konva";
import {
  ArrowLeft, Type, Square, Circle, ImagePlus, Plus, Undo2, Redo2, Download,
  Trash2, Copy, ChevronUp, ChevronDown, Lock, Unlock, Loader2, Check, Sparkles, Maximize2
} from "lucide-react";
import {
  blankPage, makeId, SIZE_PRESETS, type StudioDoc, type StudioElement, type StudioPage, type TextElement, type ShapeElement
} from "@/domain/studio/schema";
import { saveStudioProject, renameStudioProject, createStudioResize } from "@/server/actions/studio";
import { dataUrlToU8, zipBlobs, downloadBlob, safeName } from "@/lib/image-tools";

const CanvasStage = dynamic(() => import("@/components/studio/CanvasStage"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400">캔버스 불러오는 중…</div>
});

type SaveState = "saved" | "saving" | "dirty" | "error";
const EXPORT_FORMATS = [
  { key: "png", label: "PNG", mime: "image/png" },
  { key: "jpg", label: "JPG", mime: "image/jpeg" },
  { key: "webp", label: "WEBP", mime: "image/webp" }
] as const;

// 마케팅 문구 프리셋 — 원클릭으로 텍스트 요소 삽입(C3). 강조 항목은 크게.
const COPY_PRESETS: { group: string; big?: boolean; items: string[] }[] = [
  { group: "CTA", items: ["지금 예약하기", "무료 상담 신청", "자세히 보기", "문의하기"] },
  { group: "할인·혜택", items: ["최대 50% 할인", "오늘만 특가", "선착순 마감", "1+1 이벤트"] },
  { group: "강조", big: true, items: ["NEW", "BEST", "이벤트", "한정 수량"] },
  { group: "기간", items: ["이번 주말 한정", "오픈 특가", "재고 소진 시 마감"] }
];

function clone<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
}

export function EditorClient({
  projectId, initialTitle, initialDoc, brandColors = []
}: { projectId: string; initialTitle: string; initialDoc: StudioDoc; brandColors?: string[] }) {
  const router = useRouter();
  const [doc, setDoc] = useState<StudioDoc>(initialDoc);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [scale, setScale] = useState(0.4);
  const [showExport, setShowExport] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showResize, setShowResize] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const past = useRef<StudioDoc[]>([]);
  const future = useRef<StudioDoc[]>([]);
  const stageRef = useRef<Konva.Stage | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRun = useRef(true);
  const scaleRef = useRef(0.4); // 현재 화면 스케일(멀티페이지 내보내기에서 프레임 대기 후 최신값 참조)

  const page = doc.pages[Math.min(pageIndex, doc.pages.length - 1)];
  const selected = page.elements.find((e) => e.id === selectedId) ?? null;

  // ── 캔버스 맞춤 스케일 ──
  useEffect(() => {
    function fit() {
      const el = wrapRef.current;
      if (!el) return;
      const availW = el.clientWidth - 48;
      const availH = el.clientHeight - 48;
      setScale(Math.min(availW / page.width, availH / page.height, 1));
    }
    fit();
    const ro = new ResizeObserver(fit);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [page.width, page.height]);

  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // 첫 방문 온보딩(코치마크) — 1회만.
  useEffect(() => {
    try { if (!localStorage.getItem("erp:studio:coach")) setShowCoach(true); } catch { /* noop */ }
  }, []);
  function dismissCoach() {
    try { localStorage.setItem("erp:studio:coach", "1"); } catch { /* noop */ }
    setShowCoach(false);
  }

  // ── 문서 갱신(히스토리 포함) ──
  const commit = useCallback((next: StudioDoc) => {
    past.current.push(clone(doc));
    if (past.current.length > 80) past.current.shift();
    future.current = [];
    setDoc(next);
    setSaveState("dirty");
  }, [doc]);

  const updatePage = useCallback((mut: (p: StudioPage) => void) => {
    const next = clone(doc);
    mut(next.pages[pageIndex]);
    commit(next);
  }, [doc, pageIndex, commit]);

  const changeElement = useCallback((id: string, patch: Partial<StudioElement>) => {
    updatePage((p) => {
      const idx = p.elements.findIndex((e) => e.id === id);
      if (idx >= 0) p.elements[idx] = { ...p.elements[idx], ...patch } as StudioElement;
    });
  }, [updatePage]);

  function addElement(el: StudioElement) {
    updatePage((p) => p.elements.push(el));
    setSelectedId(el.id);
  }

  function addText() {
    const t: TextElement = {
      id: makeId("tx"), type: "text", x: page.width * 0.15, y: page.height * 0.4,
      width: page.width * 0.7, height: 80, rotation: 0, opacity: 1, locked: false,
      text: "텍스트를 입력하세요", fontSize: Math.round(page.width * 0.06),
      fontFamily: "Pretendard, sans-serif", fill: "#111111", align: "center",
      fontStyle: "bold", lineHeight: 1.2, letterSpacing: 0
    };
    addElement(t);
  }
  function addPresetText(text: string, big?: boolean) {
    const t: TextElement = {
      id: makeId("tx"), type: "text", x: page.width * 0.1, y: page.height * 0.42,
      width: page.width * 0.8, height: 80, rotation: 0, opacity: 1, locked: false,
      text, fontSize: Math.round(page.width * (big ? 0.12 : 0.06)),
      fontFamily: "Pretendard, sans-serif", fill: big ? "#d9662e" : "#111111", align: "center",
      fontStyle: "bold", lineHeight: 1.2, letterSpacing: 0
    };
    addElement(t);
    setShowCopy(false);
  }
  function addShape(type: "rect" | "ellipse") {
    const s: ShapeElement = {
      id: makeId("sh"), type, x: page.width * 0.3, y: page.height * 0.35,
      width: page.width * 0.4, height: page.width * 0.4, rotation: 0, opacity: 1, locked: false,
      fill: "#d9662e", cornerRadius: type === "rect" ? 16 : 0, stroke: null, strokeWidth: 0
    };
    addElement(s);
  }
  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsDataURL(file);
    });
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = async () => {
      const naturalW = img.width;
      const naturalH = img.height;
      URL.revokeObjectURL(objUrl);
      const maxW = page.width * 0.8;
      const width = Math.min(naturalW, maxW);
      const height = width * (naturalH / naturalW || 1);

      // 1순위: 에셋 저장소 업로드(픽셀을 프로젝트 JSON 밖으로). 실패 시 데이터 URL 폴백.
      setUploading(true);
      let src: string | null = null;
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("width", String(naturalW));
        fd.append("height", String(naturalH));
        const res = await fetch("/api/studio/uploads", { method: "POST", body: fd });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.ok && json.asset?.url) src = String(json.asset.url);
      } catch {
        /* 네트워크/엔드포인트 실패 → 폴백 */
      }
      if (!src) src = await fileToDataUrl(file);
      setUploading(false);

      addElement({
        id: makeId("im"), type: "image", src,
        x: (page.width - width) / 2, y: (page.height - height) / 2,
        width, height, rotation: 0, opacity: 1, locked: false, cornerRadius: 0
      });
    };
    img.src = objUrl;
  }

  function deleteSelected() {
    if (!selectedId) return;
    updatePage((p) => {
      const idx = p.elements.findIndex((e) => e.id === selectedId);
      if (idx >= 0) p.elements.splice(idx, 1);
    });
    setSelectedId(null);
  }
  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...clone(selected), id: makeId(selected.type.slice(0, 2)), x: selected.x + 24, y: selected.y + 24 };
    addElement(copy);
  }
  function reorder(dir: "front" | "back") {
    if (!selectedId) return;
    updatePage((p) => {
      const idx = p.elements.findIndex((e) => e.id === selectedId);
      if (idx < 0) return;
      const [el] = p.elements.splice(idx, 1);
      if (dir === "front") p.elements.push(el);
      else p.elements.unshift(el);
    });
  }

  // ── 페이지 관리 ──
  function addPage() {
    const next = clone(doc);
    next.pages.push(blankPage(page.width, page.height));
    commit(next);
    setPageIndex(next.pages.length - 1);
    setSelectedId(null);
  }
  function duplicatePage() {
    const next = clone(doc);
    const dup = clone(page);
    dup.id = makeId("pg");
    dup.elements = dup.elements.map((e) => ({ ...e, id: makeId(e.type.slice(0, 2)) }));
    next.pages.splice(pageIndex + 1, 0, dup);
    commit(next);
    setPageIndex(pageIndex + 1);
    setSelectedId(null);
  }
  function deletePage() {
    if (doc.pages.length <= 1) return;
    const next = clone(doc);
    next.pages.splice(pageIndex, 1);
    commit(next);
    setPageIndex(Math.max(0, pageIndex - 1));
    setSelectedId(null);
  }

  // ── 실행취소/다시실행 ──
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(clone(doc));
    setDoc(prev);
    setSelectedId(null);
    setSaveState("dirty");
  }, [doc]);
  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!nxt) return;
    past.current.push(clone(doc));
    setDoc(nxt);
    setSelectedId(null);
    setSaveState("dirty");
  }, [doc]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) { e.preventDefault(); deleteSelected(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, selectedId]);

  // ── 래스터화(핸들 제외) ──
  const rasterize = useCallback((mime: string, quality: number, pixelRatio: number): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const tr = stage.findOne("Transformer") as Konva.Transformer | undefined;
    const wasVisible = tr?.visible() ?? false;
    tr?.hide();
    const url = stage.toDataURL({ mimeType: mime, quality, pixelRatio });
    if (wasVisible) tr?.show();
    stage.batchDraw();
    return url;
  }, []);

  // ── 자동저장 ──
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const thumb = pageIndex === 0 ? rasterize("image/webp", 0.6, Math.min(0.4, 240 / (page.width * scale || 1))) : undefined;
      const res = await saveStudioProject({ id: projectId, doc, thumbnail: thumb ?? undefined });
      setSaveState(res.ok ? "saved" : "error");
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  async function onTitleBlur() {
    const t = title.trim();
    if (!t || t === initialTitle) return;
    await renameStudioProject({ id: projectId, title: t });
  }

  function download(mime: string, ext: string, exportScale: number) {
    setSelectedId(null);
    setShowExport(false);
    setTimeout(() => {
      const url = rasterize(mime, 0.92, exportScale / (scale || 1));
      if (!url) return;
      const a = document.createElement("a");
      const safe = (title.trim() || "design").replace(/[^\w가-힣-]+/g, "_");
      a.href = url;
      a.download = `${safe}-${String(pageIndex + 1).padStart(2, "0")}.${ext}`;
      a.click();
    }, 40);
  }

  // 프레임 2번 대기 — 페이지 전환 후 React 커밋 + fit-scale 효과 + Konva draw 완료를 기다린다.
  function nextFrames(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }

  // 모든 페이지를 순서대로 래스터화(화면에 잠시 전환). exportScale=디자인 배율.
  async function rasterizeAllPages(mime: string, quality: number, exportScale: number) {
    const shots: { url: string; w: number; h: number }[] = [];
    const orig = pageIndex;
    setSelectedId(null);
    for (let i = 0; i < doc.pages.length; i++) {
      setPageIndex(i);
      await nextFrames();
      await nextFrames();
      const pg = doc.pages[i];
      const url = rasterize(mime, quality, exportScale / (scaleRef.current || 1));
      if (url) shots.push({ url, w: pg.width, h: pg.height });
    }
    setPageIndex(orig);
    return shots;
  }

  // 전체 페이지 → 순번 파일명 ZIP.
  async function exportZip(mime: string, ext: string, exportScale: number) {
    if (exporting) return;
    setShowExport(false);
    setExporting(`${ext.toUpperCase()} ZIP`);
    try {
      const shots = await rasterizeAllPages(mime, 0.92, exportScale);
      const safe = safeName(title.trim() || "design");
      const entries = shots.map((s, i) => ({ name: `${safe}-${String(i + 1).padStart(2, "0")}.${ext}`, data: dataUrlToU8(s.url) }));
      if (entries.length) downloadBlob(zipBlobs(entries), `${safe}.zip`);
    } finally {
      setExporting(null);
    }
  }

  // 전체 페이지 → PDF(페이지별 이미지 합성, 디자인 크기 기준).
  async function exportPdf() {
    if (exporting) return;
    setShowExport(false);
    setExporting("PDF");
    try {
      const shots = await rasterizeAllPages("image/png", 1, 2);
      if (!shots.length) return;
      const { jsPDF } = await import("jspdf");
      const first = shots[0];
      const pdf = new jsPDF({ unit: "px", format: [first.w, first.h] });
      shots.forEach((s, i) => {
        if (i > 0) pdf.addPage([s.w, s.h]);
        pdf.addImage(s.url, "PNG", 0, 0, s.w, s.h);
      });
      pdf.save(`${safeName(title.trim() || "design")}.pdf`);
    } finally {
      setExporting(null);
    }
  }

  // 멀티사이즈 변환(C4) — 다른 사이즈로 복제 후 이동.
  async function resizeTo(presetKey: string) {
    setShowResize(false);
    setResizing(true);
    const res = await createStudioResize({ id: projectId, presetKey });
    setResizing(false);
    if (res.ok && res.data) router.push(`/studio/${res.data.id}` as Route);
  }

  const saveLabel = useMemo(() => ({
    saved: "저장됨", saving: "저장 중…", dirty: "변경됨", error: "저장 실패"
  })[saveState], [saveState]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* 상단바 */}
      <header className="flex items-center gap-3 border-b border-line bg-card px-3 py-2">
        <Link href="/studio" className="rounded-lg p-1.5 text-slate-500 hover:bg-surface" aria-label="목록으로">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={onTitleBlur}
          className="min-w-0 max-w-[240px] flex-1 rounded-lg bg-transparent px-2 py-1 text-sm font-semibold text-ink outline-none hover:bg-surface focus:bg-surface"
          aria-label="디자인 이름"
        />
        <span className="flex items-center gap-1 text-xs text-slate-400">
          {uploading ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> 이미지 업로드 중…</>
          ) : (
            <>
              {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : saveState === "saved" ? <Check className="h-3 w-3" /> : null}
              {saveLabel}
            </>
          )}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={undo} className="rounded-lg p-1.5 text-slate-500 hover:bg-surface" aria-label="실행취소"><Undo2 className="h-4 w-4" /></button>
          <button type="button" onClick={redo} className="rounded-lg p-1.5 text-slate-500 hover:bg-surface" aria-label="다시실행"><Redo2 className="h-4 w-4" /></button>
          <div className="relative">
            <button type="button" disabled={resizing} onClick={() => setShowResize((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-slate-600 hover:border-brand disabled:opacity-50">
              {resizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Maximize2 className="h-4 w-4" />} 사이즈 변환
            </button>
            {showResize && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-56 rounded-xl border border-line bg-card p-2 shadow-xl">
                <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">다른 사이즈로 복제</p>
                {SIZE_PRESETS.map((p) => (
                  <button key={p.key} type="button" onClick={() => resizeTo(p.key)} className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-surface">{p.label}</button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" disabled={!!exporting} onClick={() => setShowExport((v) => !v)} className="ml-1 flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {exporting ? `${exporting} 생성 중…` : "다운로드"}
            </button>
            {showExport && !exporting && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-56 rounded-xl border border-line bg-card p-2 shadow-xl">
                <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">현재 페이지</p>
                {EXPORT_FORMATS.map((f) => (
                  <div key={f.key} className="flex items-center justify-between px-2 py-1">
                    <span className="text-sm text-ink">{f.label}</span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => download(f.mime, f.key, 1)} className="rounded border border-line px-1.5 py-0.5 text-[11px] hover:border-brand">1x</button>
                      <button type="button" onClick={() => download(f.mime, f.key, 2)} className="rounded border border-line px-1.5 py-0.5 text-[11px] hover:border-brand">2x</button>
                    </span>
                  </div>
                ))}
                {doc.pages.length > 1 && (
                  <>
                    <div className="my-1 border-t border-line" />
                    <p className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400">전체 페이지 · {doc.pages.length}장</p>
                    {EXPORT_FORMATS.map((f) => (
                      <div key={`zip-${f.key}`} className="flex items-center justify-between px-2 py-1">
                        <span className="text-sm text-ink">{f.label} ZIP</span>
                        <span className="flex gap-1">
                          <button type="button" onClick={() => exportZip(f.mime, f.key, 1)} className="rounded border border-line px-1.5 py-0.5 text-[11px] hover:border-brand">1x</button>
                          <button type="button" onClick={() => exportZip(f.mime, f.key, 2)} className="rounded border border-line px-1.5 py-0.5 text-[11px] hover:border-brand">2x</button>
                        </span>
                      </div>
                    ))}
                    <button type="button" onClick={exportPdf} className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-left text-sm text-ink hover:border-brand">PDF 전체 페이지</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 좌측 도구 */}
        <aside className="flex w-16 flex-col items-center gap-1 border-r border-line bg-card py-3">
          {[
            { icon: Type, label: "텍스트", fn: addText },
            { icon: Square, label: "사각형", fn: () => addShape("rect") },
            { icon: Circle, label: "원", fn: () => addShape("ellipse") },
            { icon: ImagePlus, label: "이미지", fn: () => fileRef.current?.click() }
          ].map((b) => (
            <button key={b.label} type="button" onClick={b.fn} className="flex w-full flex-col items-center gap-1 rounded-lg py-2 text-[10px] text-slate-500 hover:bg-surface hover:text-brand">
              <b.icon className="h-5 w-5" /> {b.label}
            </button>
          ))}
          {/* 문구 프리셋(C3) */}
          <div className="relative w-full">
            <button type="button" onClick={() => setShowCopy((v) => !v)}
              className={`flex w-full flex-col items-center gap-1 rounded-lg py-2 text-[10px] hover:bg-surface hover:text-brand ${showCopy ? "text-brand" : "text-slate-500"}`}>
              <Sparkles className="h-5 w-5" /> 문구
            </button>
            {showCopy && (
              <div className="absolute left-[calc(100%+6px)] top-0 z-40 w-52 rounded-xl border border-line bg-card p-2 text-left shadow-xl">
                {COPY_PRESETS.map((g) => (
                  <div key={g.group} className="mb-2 last:mb-0">
                    <p className="px-1 pb-1 text-[10px] font-bold uppercase text-slate-400">{g.group}</p>
                    <div className="flex flex-wrap gap-1">
                      {g.items.map((it) => (
                        <button key={it} type="button" onClick={() => addPresetText(it, g.big)}
                          className="rounded-md border border-line px-2 py-1 text-xs text-ink hover:border-brand">{it}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
        </aside>

        {/* 캔버스 */}
        <div ref={wrapRef} className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#eef0f3] dark:bg-[#1a1c20]">
          {showCoach && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-2xl">
                <p className="text-sm font-bold text-ink">디자인 스튜디오, 3단계면 끝!</p>
                <ol className="mt-3 space-y-2.5 text-sm text-slate-600">
                  {[
                    "왼쪽에서 텍스트·도형·이미지·문구를 추가하세요.",
                    "캔버스에서 드래그·리사이즈하고, 오른쪽에서 색·크기를 바꾸세요.",
                    "오른쪽 위 다운로드로 PNG·WEBP·ZIP·PDF 내보내기."
                  ].map((tip, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={dismissCoach} className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">시작하기</button>
              </div>
            </div>
          )}
          <div className="shadow-xl">
            <CanvasStage
              page={page}
              scale={scale}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChangeElement={changeElement}
              onEditText={setSelectedId}
              onReady={(s) => { stageRef.current = s; }}
            />
          </div>
        </div>

        {/* 우측 속성 */}
        <aside className="w-64 shrink-0 overflow-y-auto border-l border-line bg-card p-3">
          {selected ? (
            <ElementProperties el={selected} onChange={(patch) => changeElement(selected.id, patch)}
              onDelete={deleteSelected} onDuplicate={duplicateSelected} onReorder={reorder} brandColors={brandColors} />
          ) : (
            <PageProperties page={page} onChange={(bg) => updatePage((p) => { p.background = bg; })} />
          )}
        </aside>
      </div>

      {/* 하단 페이지 스트립 */}
      <footer className="flex items-center gap-2 overflow-x-auto border-t border-line bg-card px-3 py-2">
        {doc.pages.map((pg, i) => (
          <button key={pg.id} type="button" onClick={() => { setPageIndex(i); setSelectedId(null); }}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${i === pageIndex ? "border-brand bg-brand/10 text-brand" : "border-line text-slate-400 hover:border-brand"}`}>
            {i + 1}
          </button>
        ))}
        <button type="button" onClick={addPage} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-line text-slate-400 hover:border-brand hover:text-brand" aria-label="페이지 추가">
          <Plus className="h-4 w-4" />
        </button>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={duplicatePage} className="rounded-lg border border-line px-2 py-1 text-xs text-slate-500 hover:border-brand">페이지 복제</button>
          <button type="button" onClick={deletePage} disabled={doc.pages.length <= 1} className="rounded-lg border border-line px-2 py-1 text-xs text-slate-500 hover:border-brand disabled:opacity-40">페이지 삭제</button>
        </div>
      </footer>
    </div>
  );
}

// ── 우측: 요소 속성 ──
function ElementProperties({ el, onChange, onDelete, onDuplicate, onReorder, brandColors }: {
  el: StudioElement;
  onChange: (patch: Partial<StudioElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorder: (dir: "front" | "back") => void;
  brandColors: string[];
}) {
  const canFill = el.type === "text" || el.type === "rect" || el.type === "ellipse";
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onDuplicate} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-line py-1.5 text-xs hover:border-brand"><Copy className="h-3.5 w-3.5" /> 복제</button>
        <button type="button" onClick={() => onReorder("front")} className="rounded-lg border border-line p-1.5 hover:border-brand" aria-label="앞으로"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => onReorder("back")} className="rounded-lg border border-line p-1.5 hover:border-brand" aria-label="뒤로"><ChevronDown className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => onChange({ locked: !el.locked })} className="rounded-lg border border-line p-1.5 hover:border-brand" aria-label="잠금">
          {el.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={onDelete} className="rounded-lg border border-line p-1.5 text-red-500 hover:border-red-500" aria-label="삭제"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>

      {canFill && brandColors.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-semibold text-slate-500">브랜드 색</p>
          <div className="flex flex-wrap gap-1.5">
            {brandColors.map((c) => (
              <button key={c} type="button" onClick={() => onChange({ fill: c })} title={c}
                className="h-6 w-6 rounded-md border border-line transition hover:scale-110" style={{ background: c }} aria-label={`색 ${c} 적용`} />
            ))}
          </div>
        </div>
      )}

      {el.type === "text" && (
        <>
          <Field label="텍스트 내용">
            <textarea value={el.text} onChange={(e) => onChange({ text: e.target.value })} rows={3}
              className="w-full resize-none rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="크기"><NumberInput value={el.fontSize} min={8} max={400} onChange={(v) => onChange({ fontSize: v })} /></Field>
            <Field label="색상"><ColorInput value={el.fill} onChange={(v) => onChange({ fill: v })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="정렬">
              <select value={el.align} onChange={(e) => onChange({ align: e.target.value as TextElement["align"] })} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand">
                <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
              </select>
            </Field>
            <Field label="굵기">
              <button type="button" onClick={() => onChange({ fontStyle: el.fontStyle.includes("bold") ? "normal" : "bold" })}
                className={`w-full rounded-lg border py-1.5 text-sm font-bold ${el.fontStyle.includes("bold") ? "border-brand text-brand" : "border-line text-slate-500"}`}>B</button>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="행간"><NumberInput value={el.lineHeight} min={0.8} max={3} step={0.1} onChange={(v) => onChange({ lineHeight: v })} /></Field>
            <Field label="자간"><NumberInput value={el.letterSpacing} min={-10} max={40} onChange={(v) => onChange({ letterSpacing: v })} /></Field>
          </div>
        </>
      )}

      {(el.type === "rect" || el.type === "ellipse") && (
        <>
          <Field label="채우기 색"><ColorInput value={el.fill} onChange={(v) => onChange({ fill: v })} /></Field>
          {el.type === "rect" && (
            <Field label="모서리 둥글기"><NumberInput value={el.cornerRadius} min={0} max={400} onChange={(v) => onChange({ cornerRadius: v })} /></Field>
          )}
        </>
      )}

      {el.type === "image" && (
        <Field label="모서리 둥글기"><NumberInput value={el.cornerRadius} min={0} max={400} onChange={(v) => onChange({ cornerRadius: v })} /></Field>
      )}

      <Field label={`투명도 ${Math.round(el.opacity * 100)}%`}>
        <input type="range" min={0} max={1} step={0.05} value={el.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} className="w-full accent-brand" />
      </Field>
    </div>
  );
}

// ── 우측: 페이지(빈 선택) 속성 ──
function PageProperties({ page, onChange }: { page: StudioPage; onChange: (bg: string) => void }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-slate-400">요소를 선택하면 속성이 여기에 표시됩니다.</p>
      <Field label="배경 색"><ColorInput value={page.background} onChange={onChange} /></Field>
      <p className="text-[11px] text-slate-400">캔버스 {page.width} × {page.height}px</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
function NumberInput({ value, min, max, step = 1, onChange }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <input type="number" value={value} min={min} max={max} step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand" />
  );
}
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 shrink-0 cursor-pointer rounded border border-line bg-transparent" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand" />
    </span>
  );
}
