import { redirect } from "next/navigation";
import { FileText, LayoutGrid, List as ListIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CreateFolderForm, DeleteFolderButton, FileActions, UploadForm } from "@/components/vault/VaultControls";
import { Role } from "@/domain/types";
import { countRootVaultFiles, listVaultFiles, listVaultFolders, type VaultFileItem } from "@/server/repositories/vault";
import { getCurrentUser } from "@/server/session";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });
const dateShort = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" });

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
const isImage = (m: string) => m.startsWith("image/");

export default async function VaultPage({ searchParams }: { searchParams: Promise<{ folder?: string; view?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { folder, view } = await searchParams;
  const selectedFolderId = folder ?? null;
  const gallery = view !== "list"; // 기본 = 썸네일 갤러리
  const isSuperAdmin = user.role === Role.SUPER_ADMIN;

  const [folders, rootCount] = await Promise.all([listVaultFolders(), countRootVaultFiles()]);
  const selectedFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) ?? null : null;
  // 존재하지 않는 폴더 id면 루트로.
  const effectiveFolderId = selectedFolder ? selectedFolder.id : null;
  const files = await listVaultFiles(effectiveFolderId);
  const folderOpts = folders.map((f) => ({ id: f.id, name: f.name }));

  const columns: DataTableColumn<VaultFileItem>[] = [
    {
      key: "name",
      header: "파일",
      render: (f) => (
        <a href={`/api/vault/${f.id}`} className="flex items-center gap-2 font-medium text-brand-strong hover:underline">
          {isImage(f.mimeType) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/vault/${f.id}?preview=1`} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface text-slate-400"><FileText className="h-4 w-4" /></span>
          )}
          <span className="truncate">{f.fileName}</span>
        </a>
      )
    },
    { key: "size", header: "크기", render: (f) => <span className="text-slate-500">{humanSize(f.size)}</span> },
    { key: "uploader", header: "올린 사람", render: (f) => f.uploaderName ?? "-" },
    { key: "date", header: "업로드", render: (f) => <span className="text-xs text-slate-500">{dateFmt.format(new Date(f.createdAt))}</span> },
    { key: "actions", header: "", render: (f) => <FileActions fileId={f.id} folders={folderOpts} currentFolderId={effectiveFolderId} /> }
  ];

  function chipCls(active: boolean) {
    return active
      ? "rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white"
      : "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-slate-600 hover:bg-surface";
  }
  // 뷰 토글 링크(현재 폴더 유지).
  const folderQS = effectiveFolderId ? `folder=${effectiveFolderId}&` : "";
  const viewBtn = (active: boolean) =>
    active
      ? "inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-white"
      : "inline-flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-surface";

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="공용 파일함"
        title="보관함"
        description="팀이 공유하는 파일을 폴더로 정리해 보관합니다. 폴더 생성·삭제는 최고관리자만 가능하고, 파일 업로드·삭제·폴더 이동은 누구나 할 수 있습니다."
      />

      {/* 폴더 선택 칩 */}
      <div className="flex flex-wrap items-center gap-2">
        <a href="/vault" className={chipCls(effectiveFolderId === null)}>미분류 ({rootCount})</a>
        {folders.map((f) => (
          <a key={f.id} href={`/vault?folder=${f.id}`} className={chipCls(effectiveFolderId === f.id)}>
            📁 {f.name} ({f.fileCount})
          </a>
        ))}
      </div>

      {/* 폴더 관리 (최고관리자) */}
      {isSuperAdmin ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 p-3">
          <CreateFolderForm />
          {selectedFolder ? <DeleteFolderButton folderId={selectedFolder.id} folderName={selectedFolder.name} /> : null}
        </div>
      ) : null}

      {/* 현재 위치 + 뷰 토글 + 업로드 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">
            {selectedFolder ? `📁 ${selectedFolder.name}` : "미분류 (루트)"} · 파일 {files.length}개
          </p>
          <div className="flex items-center gap-1">
            <a href={`/vault?${folderQS}view=grid`} className={viewBtn(gallery)}><LayoutGrid className="h-3.5 w-3.5" /> 갤러리</a>
            <a href={`/vault?${folderQS}view=list`} className={viewBtn(!gallery)}><ListIcon className="h-3.5 w-3.5" /> 목록</a>
          </div>
        </div>
        <UploadForm folderId={effectiveFolderId} />
      </div>

      {files.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-10 text-center text-sm text-slate-400">
          이 위치에 파일이 없습니다. 위에서 파일을 업로드하세요.
        </p>
      ) : gallery ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {files.map((f) => (
            <div key={f.id} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-card">
              <a href={`/api/vault/${f.id}`} className="relative block aspect-square bg-surface" title={`${f.fileName} — 다운로드`}>
                {isImage(f.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/vault/${f.id}?preview=1`} alt={f.fileName} loading="lazy" decoding="async" className="h-full w-full object-cover transition group-hover:opacity-90" />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300">
                    <FileText className="h-10 w-10" />
                    <span className="max-w-[80%] truncate text-[10px] text-slate-400">{f.mimeType.split("/")[1] ?? "file"}</span>
                  </span>
                )}
              </a>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <p className="truncate text-sm font-medium text-ink" title={f.fileName}>{f.fileName}</p>
                <p className="text-[11px] text-slate-400">{humanSize(f.size)} · {dateShort.format(new Date(f.createdAt))} · {f.uploaderName ?? "-"}</p>
                <div className="mt-1">
                  <FileActions fileId={f.id} folders={folderOpts} currentFolderId={effectiveFolderId} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable columns={columns} rows={files} emptyMessage="이 위치에 파일이 없습니다. 위에서 파일을 업로드하세요." />
      )}
    </div>
  );
}
