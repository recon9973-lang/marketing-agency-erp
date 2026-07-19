"use client";

// 검색지수 스냅샷 저장 버튼 — 저장 성공/실패를 명확히 피드백(되는지 안 되는지 표시).
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveTrendSnapshotState, type SnapshotSaveState } from "@/server/actions/trend-snapshot";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-strong hover:bg-surface disabled:opacity-50"
    >
      {pending ? "저장 중…" : "현재 결과 저장"}
    </button>
  );
}

export function SnapshotSaveForm({ brand, category, competitors }: { brand: string; category: string; competitors: string }) {
  const [state, action] = useActionState<SnapshotSaveState, FormData>(saveTrendSnapshotState, null);
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="brand" value={brand} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="competitors" value={competitors} />
        <SubmitBtn />
      </form>
      {state && (
        <span className={`text-[11px] font-medium ${state.ok ? "text-emerald-600" : "text-rose-500"}`}>
          {state.ok ? "✓ " : "⚠ "}
          {state.message}
        </span>
      )}
    </div>
  );
}
