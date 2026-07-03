import { redirect } from "next/navigation";
import { CreateVaultFolderForm } from "@/components/vault/CreateVaultFolderForm";
import { DeleteVaultFolderButton } from "@/components/vault/DeleteVaultFolderButton";
import { VaultFileActions } from "@/components/vault/VaultFileActions";
import { VaultUploadForm } from "@/components/vault/VaultUploadForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Role } from "@/domain/types";
import { listVaultFiles, listVaultFolders, type VaultFileItem } from "@/server/repositories/vault";
import { getCurrentUser } from "@/server/session";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" });

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📕";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "📊";
  if (mimeType.includes("word") || mimeType.startsWith("text/")) return "📝";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "🗜️";
  return "📎";
}

function FileList({
  files,
  folders
}: {
  files: VaultFileItem[];
  folders: Array<{ id: string; name: string }>;
}) {
  if (files.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-slate-400">이 폴더에 파일이 없습니다.</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {files.map((file) => (
        <li key={file.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <a
            href={`/api/files/${file.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 flex-1 items-center gap-3 text-sm text-ink hover:text-brand"
          >
            <span className="text-lg">{fileIcon(file.mimeType)}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{file.fileName}</span>
              <span className="block text-xs text-slate-400">
                {formatFileSize(file.size)}
                {file.uploaderName ? ` · ${file.uploaderName}` : ""} · {dateFormatter.format(file.createdAt)}
              </span>
            </span>
          </a>
          <VaultFileActions
            fileId={file.id}
            folderId={file.folderId}
            fileName={file.fileName}
            folders={folders}
          />
        </li>
      ))}
    </ul>
  );
}

export default async function VaultPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.role === Role.SUPER_ADMIN;
  const [folders, files] = await Promise.all([listVaultFolders(), listVaultFiles()]);
  const folderOptions = folders.map((folder) => ({ id: folder.id, name: folder.name }));

  const rootFiles = files.filter((file) => file.folderId === null);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="보관함"
        title="공용 파일함"
        description="거래처 소재·자료를 폴더로 정리해 함께 씁니다."
      />

      {/* 기능 설명(권한 안내)을 알기 쉽게 표기한다. */}
      <div className="space-y-1 rounded-md border border-line bg-surface/60 p-4 text-sm text-slate-600">
        <p className="font-semibold text-ink">이 화면에서 할 수 있는 것</p>
        <p>
          <span className="mr-1">📁</span>
          <span className="font-medium text-ink">폴더 만들기·삭제</span> — 최고관리자만 할 수 있습니다.
          <span className="text-slate-400"> (폴더를 지워도 안의 파일은 지워지지 않고 ‘미분류’로 옮겨집니다.)</span>
        </p>
        <p>
          <span className="mr-1">📎</span>
          <span className="font-medium text-ink">파일 올리기·삭제·이동</span> — 누구나 할 수 있습니다.
          <span className="text-slate-400"> (파일 1개당 4MB 이하.)</span>
        </p>
      </div>

      {/* 폴더 관리 (최고관리자 전용) */}
      <div className="space-y-3 rounded-md border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">폴더</h2>
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-slate-500">
            {isAdmin ? "최고관리자: 폴더 관리 가능" : "폴더 관리는 최고관리자만 가능"}
          </span>
        </div>

        {isAdmin ? (
          <CreateVaultFolderForm />
        ) : (
          <p className="text-xs text-slate-400">폴더를 만들거나 삭제하려면 최고관리자에게 요청하세요.</p>
        )}

        {folders.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {folders.map((folder) => (
              <li
                key={folder.id}
                className="flex items-center gap-3 rounded-md border border-line bg-surface/60 px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">📁 {folder.name}</span>
                <span className="text-xs text-slate-400">{folder.fileCount}개</span>
                {isAdmin ? <DeleteVaultFolderButton folderId={folder.id} folderName={folder.name} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400">아직 폴더가 없습니다. 파일은 ‘미분류’에 쌓입니다.</p>
        )}
      </div>

      {/* 파일 업로드 (누구나) */}
      <div className="space-y-3 rounded-md border border-line bg-white p-4">
        <h2 className="text-base font-semibold text-ink">파일 올리기</h2>
        <VaultUploadForm folders={folderOptions} />
      </div>

      {/* 파일 목록: 미분류 + 폴더별 */}
      {files.length === 0 ? (
        <EmptyState title="아직 올라온 파일이 없습니다" description="위에서 파일을 올려 공용 자료를 모아보세요." />
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-md border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line bg-surface/50 px-4 py-2">
              <p className="text-sm font-semibold text-ink">미분류</p>
              <span className="text-xs text-slate-400">{rootFiles.length}개</span>
            </div>
            <FileList files={rootFiles} folders={folderOptions} />
          </div>

          {folders.map((folder) => {
            const folderFiles = files.filter((file) => file.folderId === folder.id);
            return (
              <div key={folder.id} className="overflow-hidden rounded-md border border-line bg-white">
                <div className="flex items-center justify-between border-b border-line bg-surface/50 px-4 py-2">
                  <p className="text-sm font-semibold text-ink">📁 {folder.name}</p>
                  <span className="text-xs text-slate-400">{folderFiles.length}개</span>
                </div>
                <FileList files={folderFiles} folders={folderOptions} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
