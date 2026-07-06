import { Role } from "@/domain/types";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/session";

export type WeeklyReportItem = {
  id: string;
  authorId: string;
  authorName: string;
  weekStart: Date;
  summary: string;
  achievements: string | null;
  plans: string | null;
  issues: string | null;
  status: string;
  updatedAt: Date;
  editable: boolean;
};

/** 관리자 이상은 전체, 담당자는 본인 것만. */
export async function fetchWeeklyReportsForUser(user: CurrentUser): Promise<WeeklyReportItem[]> {
  const isManager = user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN;
  const rows = await db.weeklyReport.findMany({
    where: isManager ? {} : { authorId: user.id },
    orderBy: [{ weekStart: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      authorId: true,
      weekStart: true,
      summary: true,
      achievements: true,
      plans: true,
      issues: true,
      status: true,
      updatedAt: true,
      author: { select: { name: true } }
    }
  });
  return rows.map((w) => ({
    id: w.id,
    authorId: w.authorId,
    authorName: w.author.name,
    weekStart: w.weekStart,
    summary: w.summary,
    achievements: w.achievements,
    plans: w.plans,
    issues: w.issues,
    status: w.status,
    updatedAt: w.updatedAt,
    editable: isManager || w.authorId === user.id
  }));
}
