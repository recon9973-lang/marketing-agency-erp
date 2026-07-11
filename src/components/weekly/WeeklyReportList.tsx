"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWeeklyReport } from "@/server/actions/weekly-reports";

export type WeeklyItem = {
  id: string;
  authorName: string;
  weekStart: string; // ISO
  summary: string;
  achievements: string | null;
  plans: string | null;
  issues: string | null;
  editable: boolean;
};

const rangeFmt = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });

function weekLabel(iso: string) {
  const start = new Date(iso);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${rangeFmt.format(start)} ~ ${rangeFmt.format(end)}`;
}

function Section({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{text}</p>
    </div>
  );
}

export function WeeklyReportList({ items }: { items: WeeklyItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onDelete(id: string) {
    if (!confirm("이 주간보고를 삭제할까요?")) return;
    start(async () => {
      const res = await deleteWeeklyReport({ id });
      if (res.ok) router.refresh();
      else alert("삭제에 실패했습니다.");
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center text-sm text-slate-500">
        작성된 주간보고가 없습니다. ‘+ 주간보고 작성’으로 시작하세요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((w) => (
        <article key={w.id} className="rounded-2xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-strong">{weekLabel(w.weekStart)}</span>
              <span className="ml-2 text-sm font-semibold text-ink">{w.authorName}</span>
            </div>
            {w.editable ? (
              <button type="button" onClick={() => onDelete(w.id)} disabled={pending} className="text-xs font-semibold text-danger hover:underline disabled:opacity-50">
                삭제
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-medium text-ink">{w.summary}</p>
          <Section label="이번 주 완료/성과" text={w.achievements} />
          <Section label="다음 주 계획" text={w.plans} />
          <Section label="이슈/공유사항" text={w.issues} />
        </article>
      ))}
    </div>
  );
}
