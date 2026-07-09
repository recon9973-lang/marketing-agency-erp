import { notFound, redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MeetingRecorder } from "@/components/meetings/MeetingRecorder";
import { MeetingMinutesView } from "@/components/meetings/MeetingMinutesView";
import { AttendeeCheckIn } from "@/components/meetings/AttendeeCheckIn";
import { DeleteMeetingButton } from "@/components/meetings/DeleteMeetingButton";
import { getMeetingDetail } from "@/server/repositories/meetings";
import { isAiConfigured } from "@/server/ai/claude";
import { isTranscribeConfigured } from "@/server/ai/transcribe";
import { getCurrentUser } from "@/server/session";

// 녹음/전사는 수십 초 걸릴 수 있어 넉넉히.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const dateFmt = new Intl.DateTimeFormat("ko-KR", { dateStyle: "full", timeStyle: "short" });

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const meeting = await getMeetingDetail(id);
  if (!meeting) notFound();

  return (
    <div className="space-y-6">
      <a href="/meetings" className="text-sm font-semibold text-brand-strong hover:underline">← 회의 목록</a>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <DashboardHeader
          eyebrow={meeting.clientName ? `거래처 · ${meeting.clientName}` : "사내 회의"}
          title={meeting.title}
          description={`${dateFmt.format(new Date(meeting.meetingDate))} · 개설 ${meeting.authorName}`}
        />
        <DeleteMeetingButton meetingId={meeting.id} />
      </div>

      <AttendeeCheckIn meetingId={meeting.id} attendees={meeting.attendees} currentUserId={user.id} />

      <MeetingRecorder
        meetingId={meeting.id}
        transcribeConfigured={isTranscribeConfigured()}
        aiConfigured={isAiConfigured()}
        initialTranscript={meeting.transcript ?? ""}
      />

      {meeting.minutes ? <MeetingMinutesView minutes={meeting.minutes} /> : null}
    </div>
  );
}
