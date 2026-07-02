import { Role, UserStatus } from "@/domain/types";
import { db } from "@/server/db";

export type MarketerOption = {
  id: string;
  name: string;
};

export async function fetchMarketerOptions(): Promise<MarketerOption[]> {
  return db.user.findMany({
    where: { role: Role.MARKETER, isActive: true, status: UserStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: { id: true, name: true }
  });
}
