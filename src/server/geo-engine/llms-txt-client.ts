// 목표 경로: src/server/geo-engine/llms-txt-client.ts
//
// 거래처 기준 llms.txt 조립(DB 조회 포함) — GEO 페이지와 공개 라우트(/portal/[token]/llms.txt)가 공유.
// 순수 생성기(llms-txt.ts)에 거래처 정보 + 게시된 답변 페이지를 결합해 본문/URL을 만든다.
import { db } from "@/server/db";
import { listPublishedPages } from "@/server/repositories/geo";
import { buildLlmsTxt, llmsInputFromClient } from "@/server/geo-engine/llms-txt";

export type ClientLlmsTxt = { clientName: string; text: string; urls: string[] };

/** 거래처 부서명 우선순위: 업종 카테고리 → 병원 프로필 진료과 첫 항목. */
function pickDepartment(client: {
  industryCategory?: { name: string } | null;
  hospitalProfile?: { departments: string | null } | null;
}): string | null {
  return (
    client.industryCategory?.name ??
    client.hospitalProfile?.departments?.split(/[,\n]/)[0]?.trim() ??
    null
  );
}

/**
 * clientId로 llms.txt 본문·게시 URL을 조립한다. 거래처가 없으면 null.
 * 게시된(publishedUrl 보유) 답변 페이지만 포함.
 */
export async function buildClientLlmsTxt(clientId: string): Promise<ClientLlmsTxt | null> {
  const [client, publishedPages] = await Promise.all([
    db.client.findUnique({
      where: { id: clientId },
      select: {
        name: true,
        region: true,
        industryCategory: { select: { name: true } },
        hospitalProfile: { select: { departments: true } }
      }
    }),
    listPublishedPages(clientId).catch(() => [])
  ]);
  if (!client) return null;

  const text = buildLlmsTxt(
    llmsInputFromClient({
      hospitalName: client.name || "병원",
      department: pickDepartment(client),
      region: client.region || null,
      publishedPages
    })
  );
  return { clientName: client.name, text, urls: publishedPages.map((p) => p.publishedUrl) };
}
