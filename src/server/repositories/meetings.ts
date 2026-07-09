import { db } from "@/server/db";

export type MeetingListItem = {
  id: string;
  title: string;
  clientName: string | null;
  authorName: string;
  status: string;
  attendeeCount: number;
  meetingDate: Date;
};

export type MeetingAttendeeItem = { userId: string; name: string; checkedInAt: Date };

export type MeetingDetail = {
  id: string;
  title: string;
  clientName: string | null;
  authorName: string;
  authorId: string;
  status: string;
  transcript: string | null;
  minutes: string | null;
  meetingDate: Date;
  attendees: MeetingAttendeeItem[];
};

export async function listMeetings(): Promise<MeetingListItem[]> {
  const rows = await db.meeting.findMany({
    orderBy: { meetingDate: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      meetingDate: true,
      client: { select: { name: true } },
      author: { select: { name: true } },
      _count: { select: { attendees: true } }
    }
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    clientName: m.client?.name ?? null,
    authorName: m.author.name,
    status: m.status,
    attendeeCount: m._count.attendees,
    meetingDate: m.meetingDate
  }));
}

export async function getMeetingDetail(id: string): Promise<MeetingDetail | null> {
  const m = await db.meeting.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      author: { select: { name: true } },
      attendees: {
        orderBy: { checkedInAt: "asc" },
        select: { userId: true, checkedInAt: true, user: { select: { name: true } } }
      }
    }
  });
  if (!m) return null;
  return {
    id: m.id,
    title: m.title,
    clientName: m.client?.name ?? null,
    authorName: m.author.name,
    authorId: m.authorId,
    status: m.status,
    transcript: m.transcript,
    minutes: m.minutes,
    meetingDate: m.meetingDate,
    attendees: m.attendees.map((a) => ({ userId: a.userId, name: a.user.name, checkedInAt: a.checkedInAt }))
  };
}
