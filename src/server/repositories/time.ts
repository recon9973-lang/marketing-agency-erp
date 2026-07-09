import { UserStatus } from "@/domain/types";
import { db } from "@/server/db";

export type WorkloadRow = {
  userId: string;
  name: string;
  loggedMinutes: number;
  capacityMinutes: number; // 주간 가용(1일 가용 × 5일)
};

// 이번 주 월요일 00:00 (로컬 기준 근사) 반환.
function weekStart(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay(); // 0=일
  const diff = (day + 6) % 7; // 월요일까지 거슬러
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 이번 주 담당자별 기록시간(공수) vs 주간 가용시간. */
export async function weeklyWorkloadByOwner(now = new Date()): Promise<WorkloadRow[]> {
  const start = weekStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const [members, sums, setting] = await Promise.all([
    db.user.findMany({
      where: { status: UserStatus.ACTIVE, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    db.timeLog.groupBy({
      by: ["userId"],
      where: { workedOn: { gte: start, lt: end } },
      _sum: { minutes: true }
    }),
    // 워크로드 기준(1일 가용 분)은 회사 설정(CompanySetting) 단일값.
    db.companySetting.findFirst({ select: { workloadDailyMinutes: true } })
  ]);
  const loggedByUser = new Map(sums.map((s) => [s.userId, s._sum.minutes ?? 0]));
  const capacity = (setting?.workloadDailyMinutes ?? 480) * 5;

  return members.map((m) => ({
    userId: m.id,
    name: m.name,
    loggedMinutes: loggedByUser.get(m.id) ?? 0,
    capacityMinutes: capacity
  }));
}
