"use client";
// src/components/portal/AttachmentUploader.tsx
// Supabase Storage 직접 업로드 → savePortalAttachment 메타데이터 저장

import { useState, useRef } from "react";
import { savePortalAttachment } from "@/server/actions/portal";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// 퍼블릭 버킷 URL만 사용 (서버 키 없이 클라이언트에서 업로드)
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export function AttachmentUploader({
  requestId,
  clientId,
}: {
  requestId: string;
  clientId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const supabase = getSupabaseClient();
      const results: string[] = [];

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          setError(`${file.name}: 파일 크기가 50MB를 초과합니다.`);
          continue;
        }

        const ext = file.name.split(".").pop() ?? "bin";
        const path = `portal/${clientId}/${requestId}/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { data, error: uploadError } = await supabase.storage
          .from("client-files")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          setError(`${file.name}: 업로드 실패 — ${uploadError.message}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("client-files")
          .getPublicUrl(data.path);

        const res = await savePortalAttachment({
          fileName: file.name,
          fileUrl: urlData.publicUrl,
          fileSizeBytes: file.size,
          mimeType: file.type || undefined,
          requestId,
        });

        if (!res.ok) {
          setError(`${file.name}: 메타데이터 저장 실패 — ${res.error}`);
        } else {
          results.push(file.name);
        }
      }

      if (results.length > 0) {
        setSuccess(
          `${results.length}개 파일 업로드 완료: ${results.join(", ")}`
        );
        // 페이지 새로고침으로 첨부파일 목록 갱신
        setTimeout(() => window.location.reload(), 800);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-200
          hover:border-sky-300 hover:bg-sky-50 rounded-xl text-sm text-slate-500
          hover:text-sky-600 transition-colors disabled:opacity-50 w-full justify-center"
      >
        {uploading ? (
          <>
            <span className="animate-spin">⏳</span> 업로드 중…
          </>
        ) : (
          <>
            📎 파일 첨부 (최대 50MB, 여러 파일 가능)
          </>
        )}
      </button>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      {success && <p className="text-xs text-green-600 px-1">✅ {success}</p>}
    </div>
  );
}
