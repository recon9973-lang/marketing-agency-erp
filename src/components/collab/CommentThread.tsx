"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AtSign, MessageSquare, Send, Trash2 } from "lucide-react";
import { createComment, deleteComment } from "@/server/actions/comments";
import type { CommentItem, MemberOption } from "@/server/repositories/collab";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" });

// @이름 을 강조 표시.
function renderBody(body: string, memberNames: string[]) {
  if (memberNames.length === 0) return body;
  const escaped = memberNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  const parts = body.split(re);
  return parts.map((part, i) =>
    memberNames.includes(part) ? (
      <span key={i} className="rounded bg-brand-soft px-1 font-semibold text-brand-strong">
        @{part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function CommentThread({
  targetType,
  targetId,
  initialComments,
  members,
  currentUserId,
  canModerate
}: {
  targetType: "CLIENT" | "WORK" | "REPORT" | "CONTRACT";
  targetId: string;
  initialComments: CommentItem[];
  members: MemberOption[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? undefined;
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const memberNames = members.map((m) => m.name);

  function insertMention(name: string) {
    setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}@${name} `);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const res = await createComment({ targetType, targetId, body, path: pathname });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    start(async () => {
      const res = await deleteComment({ id, path: pathname });
      if (!res.ok) return alert(res.error);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-brand-strong" />
        <h3 className="text-sm font-bold text-ink">댓글 ({initialComments.length})</h3>
      </div>

      <div className="mt-3 space-y-3">
        {initialComments.length === 0 ? (
          <p className="rounded-lg bg-surface/60 px-3 py-4 text-center text-sm text-slate-500">
            첫 댓글을 남겨보세요. <span className="text-slate-400">@이름</span> 으로 팀원을 언급하면 알림이 갑니다.
          </p>
        ) : (
          initialComments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">
                {c.authorName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{c.authorName}</span>
                  <span className="text-xs text-slate-400">{dateFmt.format(new Date(c.createdAt))}</span>
                  {canModerate || c.authorId === currentUserId ? (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="ml-auto text-slate-300 hover:text-danger"
                      aria-label="댓글 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {renderBody(c.body, memberNames)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submit} className="mt-4 border-t border-line pt-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="댓글 입력… (@이름 으로 팀원 언급)"
          className="w-full resize-y rounded-md border border-line px-3 py-2 text-sm text-ink outline-none focus:border-brand"
        />
        {members.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <AtSign className="h-3.5 w-3.5 text-slate-400" />
            {members.slice(0, 12).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => insertMention(m.name)}
                className="rounded-full border border-line px-2 py-0.5 text-xs text-slate-600 hover:bg-surface"
              >
                @{m.name}
              </button>
            ))}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" /> {pending ? "등록 중…" : "댓글 등록"}
          </button>
        </div>
      </form>
    </section>
  );
}
