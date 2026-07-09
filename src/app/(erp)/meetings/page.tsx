import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { CreateMeetingForm } from "@/components/meetings/CreateMeetingForm";
import { listMeetings, type MeetingListItem } from "@/server/repositories/meetings";
import { listClientsForUser } from "@/server/repositories/clients";
import { getCurrentUser } from "@/server/session";

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" });

const columns: DataTableColumn<MeetingListItem>[] = [
  {
    key: "title",
    header: "회의",
    render: (m) => (
      <Link href={`/meetings/${m.id}` as Route} className="font-medium text-brand-strong hover:underline">
        {m.title}
      </Link>
    )
  },
  { key: "client", header: "거래처", render: (m) => m.clientName ?? "-" },
  { key: "date", header: "일시", render: (m) => <span className="text-xs text-slate-500">{dateFmt.format(new Date(m.meetingDate))}</span> },
  { key: "attendees", header: "참석", render: (m) => `${m.attendeeCount}명` },
  {
    key: "status",
    header: "상태",
    render: (m) =>
      m.status === "DONE" ? (
        <span className="rounded-md bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-strong">회의록 완료</span>
      ) : (
        <span className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-600">작성 전</span>
      )
  },
  { key: "author", header: "개설자", render: (m) => m.authorName }
];

export default async function MeetingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [meetings, clients] = await Promise.all([listMeetings(), listClientsForUser(user)]);

  return (
    <div className="space-y-6">
      <DashboardHeader
        eyebrow="회의"
        title="회의록"
        description="회의를 만들고 녹음 버튼을 누르면 내용을 자동으로 텍스트로 옮겨 AI가 회의록으로 정리합니다. 참석자는 본인이 '참석 체크인'을 누르면 됩니다."
      />
      <CreateMeetingForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      <DataTable columns={columns} rows={meetings} emptyMessage="등록된 회의가 없습니다. ‘+ 새 회의’로 시작하세요." />
    </div>
  );
}
