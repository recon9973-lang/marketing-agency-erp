// 목표 경로: src/components/clients/ClientList.tsx
//
// 거래처 목록 — 업종 색상 태그 + 담당자/상태 + 상세 링크. 권한 스코프는 서버 조회에서 적용.
"use client";

import type { Route } from "next";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";

type Row = {
  id: string;
  name: string;
  code: string;
  industryName: string | null;
  industryColor: string | null;
  assignedMarketerName: string | null;
  active: boolean;
  latestWorkStatus?: string | null;
  outstanding?: boolean;
};

const columns: DataTableColumn<Row>[] = [
  {
    key: "name",
    header: "거래처",
    render: (r) => (
      <div className="flex flex-col">
        <span className={`font-medium ${r.active ? "text-ink" : "text-slate-400 line-through"}`}>{r.name}</span>
        <span className="text-xs text-slate-400">{r.code}</span>
      </div>
    )
  },
  {
    key: "industry",
    header: "업종",
    render: (r) =>
      r.industryName ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
          style={{ background: (r.industryColor ?? "#e2e8f0") + "1f", color: r.industryColor ?? "#475569" }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.industryColor ?? "#94a3b8" }} />
          {r.industryName}
        </span>
      ) : (
        <span className="text-slate-300">-</span>
      )
  },
  {
    key: "owner",
    header: "담당자",
    render: (r) => r.assignedMarketerName ?? <span className="text-slate-300">미배정</span>
  },
  {
    key: "status",
    header: "상태",
    render: (r) =>
      r.active ? (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">운영중</span>
      ) : (
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">비활성</span>
      )
  },
  {
    key: "outstanding",
    header: "미수금",
    render: (r) =>
      r.outstanding ? (
        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">있음</span>
      ) : (
        <span className="text-xs text-slate-300">-</span>
      )
  },
  {
    key: "actions",
    header: "",
    render: (r) => (
      <Link href={`/clients/${r.id}` as Route} className="text-xs font-semibold text-brand-strong hover:underline">
        상세 &rarr;
      </Link>
    )
  }
];

export function ClientList({ rows }: { rows: Row[] }) {
  return <DataTable columns={columns} rows={rows} emptyMessage="표시할 거래처가 없습니다." />;
}
