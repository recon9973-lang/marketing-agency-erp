import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CreateFolderForm, DeleteFolderButton, FileActions, UploadForm } from "@/components/vault/VaultControls";
import { TrashActions } from "@/components/vault/TrashActions";
import { Role } from "@/domain/types";
import { countRootVaultFiles, listVaultFiles, listVaultFolders, listVaultTrash, type VaultFileItem } from "@/server/repositories/vault";
import { getCurrentUser } from "@/server/session";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function VaultPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { folder } = await searchParams;
  const selectedFolderId = folder ?? null;
  const isAdmin = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;

  const [folders, rootCount, trash] = await Promise.all([
    listVaultFolders(),
    countRootVaultFiles(),
    isAdmin ? listVaultTrash() : Promise.resolve([])
  ]);
  const selectedFolder = selectedFolderId ? folders.find((f) => f.id === selectedFolderId) ?? null : null;
  // 존재하지 않는 폴더 id면 루트로.
  const effectiveFolderId = selectedFolder ? selectedFolder.id : null;
  const files = await listVaultFiles(effectiveFolderId);

  const columns: DataTableColumn<VaultFileItem>[] = [
    {
      key: "name",
      header: "파일",
      render: (f) => (
        <a href={`/api/vault/${f.id}`} className="font-medium text-brand-strong hover:underline">
          {f.fileName}
        </a>
      )
    },
    { key: "size", header: "크기", render: (f) => <span className="text-slate-500">{humanSize(f.size)}</span> },
    { key: "uploader", header: "올린 사람", render: (f) => f.uploaderName ?? "-" },
    { key: "date", header: "업로드", render: (f) => <span className="text-xs text-slate-500">{dateFmt.format(new Date(f.createdAt))}</span> },
    { key: "actions", header: "", render: (f) => <FileActions fileId={f.id} /> }
  ];

  const trashColumns: DataTableColumn<VaultFileItem>[] = [
    { key: "name", header: "파일", render: (f) => <span className="font-medium text-slate-600">{f.fileName}</span> },
    { key: "size", header: "크기", render: (f) => <span className="text-slate-500">{humanSize(f.size)}</span> },
    { key: "uploader", header: "올린 사람", render: (f) => f.uploaderName ?? "-" },
    { key: "actions", header: "", render: (f) => <TrashActions fileId={f.id} /> }
  ];

  function chipCls(active: boolean) {
    return active
      ? "rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-white"
      : "rounded-full border border-line bg-white px-3.5 py-1.5 text-sm text-slate-600 hover:bg-surface";
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="공용 파일함"
        title="보관함"
        description="팀이 공유하는 파일을 폴더로 정리해 보관합니다. 폴더 생성·삭제·파일 업로드는 누구나 가능하고, 삭제한 파일은 휴지통으로 이동합니다(영구삭제·복원은 관리자)."
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

      {/* 폴더 관리 (누구나) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 p-3">
        <CreateFolderForm />
        {selectedFolder ? <DeleteFolderButton folderId={selectedFolder.id} folderName={selectedFolder.name} /> : null}
      </div>

      {/* 현재 위치 + 업로드 */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">
          {selectedFolder ? `📁 ${selectedFolder.name}` : "미분류 (루트)"} · 파일 {files.length}개
        </p>
        <UploadForm folderId={effectiveFolderId} />
      </div>

      <DataTable columns={columns} rows={files} emptyMessage="이 위치에 파일이 없습니다. 위에서 파일을 업로드하세요." />

      {/* 휴지통 (관리자 전용) */}
      {isAdmin && (
        <div className="space-y-3 border-t border-line pt-6">
          <h3 className="text-base font-semibold text-ink">🗑️ 휴지통 <span className="text-slate-400">({trash.length})</span></h3>
          <p className="text-sm text-slate-500">삭제된 파일입니다. 복원하거나 영구 삭제할 수 있습니다(관리자 전용).</p>
          <DataTable columns={trashColumns} rows={trash} emptyMessage="휴지통이 비어 있습니다." />
        </div>
      )}
    </div>
  );
}
