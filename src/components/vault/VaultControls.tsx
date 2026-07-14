"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Trash2, Upload, Download } from "lucide-react";
import { createVaultFolder, deleteVaultFolder, deleteVaultFile, moveVaultFile, uploadVaultFile } from "@/server/actions/vault";

const inputCls = "h-10 rounded-md border border-line px-3 text-sm text-ink outline-none focus:border-brand";

/** 폴더 생성 — 최고관리자 전용. */
export function CreateFolderForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    start(async () => {
      const res = await createVaultFolder({ name });
      if (!res.ok) return setError("폴더 생성에 실패했습니다.");
      setName("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 폴더 이름" className={inputCls} />
      <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">
        <FolderPlus className="h-4 w-4" /> {pending ? "생성 중…" : "폴더 만들기"}
      </button>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </form>
  );
}

/** 폴더 삭제 — 최고관리자 전용. */
export function DeleteFolderButton({ folderId, folderName }: { folderId: string; folderName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm(`'${folderName}' 폴더를 삭제할까요? 안의 파일은 미분류로 이동됩니다.`)) return;
    start(async () => {
      const res = await deleteVaultFolder({ id: folderId });
      if (!res.ok) return alert(res.error === "FORBIDDEN" ? "최고관리자만 삭제할 수 있습니다." : "삭제에 실패했습니다.");
      router.push("/vault");
    });
  }
  return (
    <button type="button" onClick={onClick} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-50">
      <Trash2 className="h-3.5 w-3.5" /> 폴더 삭제
    </button>
  );
}

/** 파일 업로드 — 누구나. */
export function UploadForm({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("파일을 선택하세요.");
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    if (folderId) fd.set("folderId", folderId);
    start(async () => {
      const res = await uploadVaultFile(fd);
      if (!res.ok) {
        setError(res.error === "FILE_TOO_LARGE" ? "파일은 8MB 이하만 올릴 수 있습니다." : "업로드에 실패했습니다.");
        return;
      }
      if (fileRef.current) fileRef.current.value = "";
      setFileName(null);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-3">
      <input
        ref={fileRef}
        type="file"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand-strong"
      />
      <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">
        <Upload className="h-4 w-4" /> {pending ? "업로드 중…" : "업로드"}
      </button>
      <span className="text-xs text-slate-500">{fileName ? `선택됨: ${fileName}` : "여기 폴더에 올립니다 (최대 8MB)"}</span>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </form>
  );
}

/** 파일 다운로드 + (선택) 폴더 이동 + 삭제(누구나). */
export function FileActions({
  fileId,
  folders,
  currentFolderId
}: {
  fileId: string;
  folders?: { id: string; name: string }[];
  currentFolderId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moving, startMove] = useTransition();

  function onDelete() {
    if (!confirm("이 파일을 삭제할까요?")) return;
    start(async () => {
      const res = await deleteVaultFile({ id: fileId });
      if (!res.ok) return alert("삭제에 실패했습니다.");
      router.refresh();
    });
  }
  function onMove(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    startMove(async () => {
      const res = await moveVaultFile({ id: fileId, folderId: v || null });
      if (!res.ok) return alert("폴더 이동에 실패했습니다.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {folders && folders.length > 0 ? (
        <select
          value={currentFolderId ?? ""}
          onChange={onMove}
          disabled={moving}
          title="폴더로 이동"
          aria-label="폴더로 이동"
          className="max-w-[112px] rounded-md border border-line bg-white px-1.5 py-1.5 text-xs text-slate-600 outline-none focus:border-brand disabled:opacity-50"
        >
          <option value="">📂 미분류</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>📁 {f.name}</option>
          ))}
        </select>
      ) : null}
      <a href={`/api/vault/${fileId}`} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface">
        <Download className="h-3.5 w-3.5" /> 다운로드
      </a>
      <button type="button" onClick={onDelete} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-red-50 disabled:opacity-50">
        <Trash2 className="h-3.5 w-3.5" /> 삭제
      </button>
    </div>
  );
}
