"use client";
// src/components/portal/CommentSection.tsx
// 보고서·요청에 달리는 댓글 섹션 (클라이언트 컴포넌트)

import { useState, useTransition } from "react";
import { addPortalComment } from "@/server/actions/portal";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; role: string };
};

export function CommentSection({
  reportId,
  requestId,
  currentUserId,
  currentUserName,
  comments: initial,
}: {
  reportId?: string;
  requestId?: string;
  currentUserId: string;
  currentUserName: string;
  comments: Comment[];
}) {
  const [comments, setComments] = useState<Comment[]>(initial);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function roleLabel(role: string) {
    if (role === "CLIENT") return "거래처";
    if (role === "MARKETER") return "마케터";
    if (role === "ADMIN") return "관리자";
    if (role === "SUPER_ADMIN") return "최고관리자";
    return role;
  }

  function roleBadge(role: string) {
    if (role === "CLIENT")
      return "bg-orange-50 text-orange-600 border border-orange-200";
    if (role === "MARKETER")
      return "bg-teal-50 text-teal-700 border border-teal-200";
    return "bg-slate-100 text-slate-600";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);

    startTransition(async () => {
      const res = await addPortalComment({ body: body.trim(), reportId, requestId });
      if (res.ok && res.comment) {
        setComments((prev) => [
          ...prev,
          {
            id: res.comment!.id,
            body: res.comment!.body,
            createdAt: res.comment!.createdAt,
            author: {
              id: currentUserId,
              name: currentUserName,
              role: "CLIENT",
            },
          },
        ]);
        setBody("");
      } else {
        setError(res.error ?? "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
      <h2 className="text-sm font-bold text-slate-700">
        댓글 · 멘션{" "}
        <span className="font-normal text-slate-400 ml-1">
          ({comments.length})
        </span>
      </h2>

      {/* 댓글 목록 */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            아직 댓글이 없습니다. 궁금한 사항을 남겨주세요.
          </p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={`flex gap-3 ${
                c.author.id === currentUserId ? "flex-row-reverse" : ""
              }`}
            >
              {/* 아바타 */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                  ${
                    c.author.role === "CLIENT"
                      ? "bg-orange-100 text-orange-600"
                      : "bg-teal-100 text-teal-700"
                  }`}
              >
                {c.author.name[0]}
              </div>

              <div
                className={`max-w-xs md:max-w-md ${
                  c.author.id === currentUserId ? "items-end" : "items-start"
                } flex flex-col gap-1`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    {c.author.name}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${roleBadge(
                      c.author.role
                    )}`}
                  >
                    {roleLabel(c.author.role)}
                  </span>
                  <span className="text-xs text-slate-300">
                    {new Date(c.createdAt).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                    ${
                      c.author.id === currentUserId
                        ? "bg-sky-500 text-white rounded-tr-sm"
                        : "bg-slate-50 text-slate-700 rounded-tl-sm"
                    }`}
                >
                  {c.body}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 입력창 */}
      <form onSubmit={handleSubmit} className="flex gap-3 pt-2 border-t border-slate-50">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="댓글을 입력하세요... (Cmd+Enter로 전송)"
          rows={2}
          className="flex-1 resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-700 placeholder-slate-300"
        />
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="self-end px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-40
            text-white text-sm font-medium rounded-xl transition-colors"
        >
          {isPending ? "…" : "전송"}
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
