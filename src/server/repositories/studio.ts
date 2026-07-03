import { UserStatus, type Role } from "@/domain/types";
import { db } from "@/server/db";
import { buildAccessibleClientWhere, loadAccessScopes } from "@/server/scope";

/**
 * 이미지 스튜디오 부트스트랩 데이터 (워크플로우 6차).
 *
 * 스튜디오(iframe) 안에서 템플릿 {업체명}{전화}{주소} 자동 치환과 제작물 태깅에
 * 쓸 실제 거래처·직원 목록을 접근 권한 범위에 맞춰 제공한다.
 */

export type StudioClient = { id: string; name: string; phone: string; addr: string };

export async function listStudioClients(user: {
  id: string;
  role: Role;
}): Promise<StudioClient[]> {
  const scopes = await loadAccessScopes(user);
  const clients = await db.client.findMany({
    where: buildAccessibleClientWhere(user, scopes),
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactPhone: true }
  });

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    phone: client.contactPhone ?? "",
    addr: ""
  }));
}

export async function listStudioStaff(): Promise<string[]> {
  const staff = await db.user.findMany({
    where: { isActive: true, status: UserStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: { name: true }
  });
  return staff.map((member) => member.name);
}
