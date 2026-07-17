"use client";
// src/app/(portal)/requests/new/page.tsx
// 새 요청/문의 작성 폼

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientRequest } from "@/server/actions/portal";

const CATEGORIES = [
  { value: "CONTENT_REQUEST", label: "콘텐츠 요청", desc: "블로그 주제, 포스팅 방향, SNS 내용 등" },
  { value: "REPORT_INQUIRY",  label: "보고서 문의", desc: "보고서 수치, 성과 해석 문의" },
  { value: "SCHEDULE_CHANGE", label: "일정 변경",   desc: "발행 일정, 미팅 날짜 변경 요청" },
  { value: "ACCOUNT_ISSUE",   label: "계정 문제",   desc: "SNS 계정, 블로그 접근 문제" },
  { value: "BILLING_INQUIRY", label: "청구 문의",   desc: "청구서, 결제 관련 문의" },
  { value: "OTHER",           label: "기타",         desc: "위 항목에 해당되지 않는 내용" },
];

export default function NewRequestPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState("CONTENT_REQUEST");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("제목과 내용을 모두 입력해주세요.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await createClientRequest({ category, title: title.trim(), body: body.trim() });
      if (res.ok && res.id) {
        router.push(`/portal/requests/${res.id}`);
      } else {
        setError(res.error ?? "오류가 발생했습니다.");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/portal/requests"
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          ← 요청 목록
        </Link>
        <h1 className="text-xl font-bold text-slate-800 mt-2">새 요청/문의</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 카테고리 선택 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            요청 유형
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`text-left p-3 rounded-xl border-2 transition-colors
                  ${
                    category === cat.value
                      ? "border-sky-400 bg-sky-50"
                      : "border-slate-100 hover:border-slate-200 bg-white"
                  }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    category === cat.value ? "text-sky-700" : "text-slate-700"
                  }`}
                >
                  {cat.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                  {cat.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="요청 제목을 입력하세요"
              maxLength={100}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-700 placeholder-slate-300"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              내용 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="구체적으로 설명해주시면 더 빠르게 처리할 수 있습니다."
              rows={6}
              className="w-full resize-none border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-sky-300 text-slate-700 placeholder-slate-300"
            />
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <p className="text-sm text-red-500 px-1">{error}</p>
        )}

        {/* 제출 */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50
              text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {isPending ? "제출 중…" : "요청 제출"}
          </button>
          <Link
            href="/portal/requests"
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
