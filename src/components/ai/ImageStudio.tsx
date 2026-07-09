"use client";

import { useState, useTransition } from "react";
import { Download, ImageIcon, LayoutTemplate, Save, Sparkles, Wand2 } from "lucide-react";
import { uploadVaultFile } from "@/server/actions/vault";
import { CardNewsMaker } from "@/components/ai/CardNewsMaker";

type Folder = { id: string; name: string };

const STYLES = [
  { value: "photo", label: "사진" },
  { value: "illustration", label: "일러스트" },
  { value: "thumbnail", label: "썸네일" },
  { value: "card", label: "카드뉴스" },
  { value: "render3d", label: "3D" }
] as const;

const ASPECTS = [
  { value: "square", label: "정사각 1:1" },
  { value: "wide", label: "가로 16:9" },
  { value: "tall", label: "세로 4:5" }
] as const;

const chip = (active: boolean) =>
  active
    ? "rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white"
    : "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-slate-600 hover:bg-surface";

type Generated = { id: string; dataUrl: string; prompt: string; style: string; aspect: string };

// data URL → File (보관함 저장용).
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

export function ImageStudio({
  imageConfigured,
  folders
}: {
  imageConfigured: boolean;
  folders: Folder[];
}) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>("photo");
  const [aspect, setAspect] = useState<string>("square");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Generated[]>([]);
  const [tab, setTab] = useState<"generate" | "cardnews">("generate");

  function generate() {
    const p = prompt.trim();
    if (!p) {
      setError("이미지 설명(프롬프트)을 입력하세요.");
      return;
    }
    setError(null);
    start(async () => {
      try {
        const res = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: p, style, aspect })
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; dataUrl?: string; error?: string };
        if (!res.ok || !data.ok || !data.dataUrl) {
          setError(data.error || "이미지 생성에 실패했습니다.");
          return;
        }
        setItems((prev) => [
          { id: `${prev.length}-${p.slice(0, 8)}`, dataUrl: data.dataUrl!, prompt: p, style, aspect },
          ...prev
        ]);
      } catch {
        setError("이미지 생성 중 오류가 발생했습니다.");
      }
    });
  }

  const tabCls = (active: boolean) =>
    active
      ? "inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
      : "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-surface";

  return (
    <div className="space-y-6">
      {/* 내부 탭: AI 생성 / 카드뉴스 제작 */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("generate")} className={tabCls(tab === "generate")}>
          <Wand2 className="h-4 w-4" /> AI 이미지 생성
        </button>
        <button type="button" onClick={() => setTab("cardnews")} className={tabCls(tab === "cardnews")}>
          <LayoutTemplate className="h-4 w-4" /> 카드뉴스 제작
        </button>
      </div>

      {tab === "cardnews" ? (
        <CardNewsMaker generatedImages={items.map((i) => i.dataUrl)} />
      ) : (
        <div className="space-y-6">
      {!imageConfigured ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          이미지 엔진이 아직 연결되지 않았습니다. <b>연동 화면</b>에서{" "}
          <code className="rounded bg-white px-1 font-mono text-[11px]">OPENAI_API_KEY</code>를 Vercel 환경 변수에 넣고 재배포하면 켜집니다.
        </div>
      ) : null}

      <div className="rounded-xl border border-line bg-white p-4">
        <label className="block">
          <span className="text-xs font-semibold text-slate-500">이미지 설명 (프롬프트) *</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="예: 밝고 다정한 한국 한의원 진료실, 따뜻한 자연광, 신뢰감 있는 분위기"
            className="mt-1 w-full resize-y rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </label>

        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500">스타일</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button key={s.value} type="button" onClick={() => setStyle(s.value)} className={chip(style === s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500">비율</p>
          <div className="flex flex-wrap gap-2">
            {ASPECTS.map((a) => (
              <button key={a.value} type="button" onClick={() => setAspect(a.value)} className={chip(aspect === a.value)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {pending ? "이미지 생성 중… (최대 1분)" : "이미지 생성"}
          </button>
          {pending ? <span className="text-xs text-slate-500">모델이 이미지를 그리고 있어요.</span> : null}
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-ink">생성한 이미지 ({items.length})</h3>
        {items.length === 0 ? (
          <p className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface/50 px-4 py-10 text-center text-sm text-slate-500">
            <ImageIcon className="h-8 w-8 text-slate-300" />
            아직 생성한 이미지가 없습니다. 위에서 프롬프트를 넣고 만들어 보세요.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((it) => (
              <ImageCard key={it.id} item={it} folders={folders} />
            ))}
          </div>
        )}
      </section>
        </div>
      )}
    </div>
  );
}

function ImageCard({ item, folders }: { item: Generated; folders: Folder[] }) {
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [folderId, setFolderId] = useState<string>("");

  function save() {
    startSave(async () => {
      const stamp = `${item.style}-${item.aspect}`;
      const file = dataUrlToFile(item.dataUrl, `이미지-${stamp}-${item.id}.png`);
      const fd = new FormData();
      fd.set("file", file);
      if (folderId) fd.set("folderId", folderId);
      const res = await uploadVaultFile(fd);
      if (!res.ok) {
        alert(res.error === "FILE_TOO_LARGE" ? "이미지가 8MB를 넘어 저장할 수 없습니다." : "보관함 저장에 실패했습니다.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <article className="overflow-hidden rounded-xl border border-line bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.dataUrl} alt={item.prompt} className="w-full bg-surface object-contain" />
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-xs text-slate-500">{item.prompt}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <a
            href={item.dataUrl}
            download={`이미지-${item.id}.png`}
            className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface"
          >
            <Download className="h-3.5 w-3.5" /> 다운로드
          </a>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="h-8 rounded-md border border-line px-2 text-xs text-slate-600 outline-none focus:border-brand"
          >
            <option value="">미분류</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saved ? "저장됨" : saving ? "저장 중…" : "보관함 저장"}
          </button>
        </div>
      </div>
    </article>
  );
}
