// 목표 경로: src/server/repositories/document-templates.ts
//
// 서식(문서 템플릿) 조회. 사용처(category)와 사용 권한(minRole)으로 필터.
import { Role } from "@/domain/types";
import { db } from "@/server/db";

export type DocumentCategoryKey = "CONTRACT" | "CLIENT" | "HR" | "GENERAL";

export type TemplateItem = {
  id: string;
  name: string;
  category: DocumentCategoryKey;
  title: string;
  body: string;
  minRole: Role;
  isActive: boolean;
  sortOrder: number;
};

// 권한 랭크 — 높을수록 상위. 사용 가능 조건: rank(user) >= rank(minRole).
const RANK: Record<Role, number> = { [Role.SUPER_ADMIN]: 3, [Role.ADMIN]: 2, [Role.MARKETER]: 1 };
export function canUseTemplate(userRole: Role, minRole: Role): boolean {
  return RANK[userRole] >= RANK[minRole];
}

/** 사용처(들)에 노출할 서식 — 활성 + 권한 충족만. 사용 화면(계약 등)에서 호출. */
export async function listTemplatesForUse(categories: DocumentCategoryKey[], userRole: Role): Promise<TemplateItem[]> {
  const rows = await db.documentTemplate.findMany({
    where: { isActive: true, category: { in: categories } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  return rows
    .filter((t) => canUseTemplate(userRole, t.minRole))
    .map((t) => ({ id: t.id, name: t.name, category: t.category, title: t.title, body: t.body, minRole: t.minRole, isActive: t.isActive, sortOrder: t.sortOrder }));
}

/** 관리 화면용 — 전체(비활성 포함). 관리자 전용. */
export async function listAllTemplates(): Promise<TemplateItem[]> {
  const rows = await db.documentTemplate.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });
  return rows.map((t) => ({ id: t.id, name: t.name, category: t.category, title: t.title, body: t.body, minRole: t.minRole, isActive: t.isActive, sortOrder: t.sortOrder }));
}
