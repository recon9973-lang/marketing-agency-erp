import { db } from "@/server/db";
import { Prisma } from "@prisma/client";
import { Role } from "@/domain/types";

// 업체명이 비었거나 프로스펙트 자리표시자면 리드를 만들지 않는다(지역 단독 분석 등).
const GENERIC_BRAND = new Set(["", "(신규 병원)", "(신규병원)", "(일반형 · 병원명 자리)"]);

/**
 * 분석(상권/전략) 저장 시 업체 기준으로 리드를 찾거나(중복 방지) 없으면 1개만 생성.
 * 같은 업체로 상권분석·마케팅 전략을 모두 진행해도 리드가 2개 생기지 않는다.
 * 식별 규칙은 createLead의 소프트중복(병원명+지역 또는 홈페이지 URL)과 동일.
 * @returns 연결할 leadId(업체명이 없으면 null → 리드 생성/연결 안 함)
 */
export async function findOrCreateLeadForAnalysis(opts: {
  brand: string | null;
  region: string | null;
  specialty: string | null;
  url: string | null;
  userId: string;
  userRole: Role;
  orgId: string | null;
}): Promise<string | null> {
  const brand = (opts.brand ?? "").trim();
  if (GENERIC_BRAND.has(brand)) return null;
  const region = opts.region?.trim() || null;
  const url = opts.url?.trim() || null;

  // 1) 기존 리드 재사용 — 병원명(+지역) 또는 홈페이지 URL 일치(가장 최근 것).
  const or: Prisma.LeadWhereInput[] = [{ hospitalName: brand, ...(region ? { region } : {}) }];
  if (url) or.push({ websiteUrl: url });
  const existing = await db.lead.findFirst({
    where: { orgId: opts.orgId, OR: or },
    select: { id: true },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return existing.id;

  // 2) 없으면 새 리드 1개 생성(자동 유입). 담당 AE는 실행자(담당자 역할일 때).
  const created = await db.lead.create({
    data: {
      hospitalName: brand,
      region,
      department: opts.specialty,
      websiteUrl: url,
      source: "분석 자동생성",
      status: "NEW",
      assigneeId: opts.userRole === Role.MARKETER ? opts.userId : null,
      orgId: opts.orgId
    }
  });
  return created.id;
}
