// 원고 스튜디오 프로젝트 조회 — 거래처별 집필 프로젝트(프롬프트).
import { db } from "@/server/db";

export type ManuscriptProjectRow = {
  id: string;
  name: string;
  prompt: string;
  notes: string | null;
  updatedAt: string;
};

export async function listManuscriptProjects(clientId: string): Promise<ManuscriptProjectRow[]> {
  try {
    const rows = await db.manuscriptProject.findMany({
      where: { clientId },
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((r) => ({ id: r.id, name: r.name, prompt: r.prompt, notes: r.notes, updatedAt: r.updatedAt.toISOString() }));
  } catch {
    // 테이블 미생성(마이그레이션 지연) 등에도 화면이 죽지 않게.
    return [];
  }
}

export type ManuscriptDraftRow = {
  id: string;
  projectId: string;
  title: string;
  kind: string;
  body: string;
  source: string;
  updatedAt: string;
};

/** 선택 거래처의 모든 프로젝트에 걸친 원고 초안을 한 번에 조회(프로젝트별 그룹핑은 호출부에서). */
export async function listManuscriptDrafts(projectIds: string[]): Promise<ManuscriptDraftRow[]> {
  if (projectIds.length === 0) return [];
  try {
    const rows = await db.manuscriptDraft.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { updatedAt: "desc" }
    });
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      title: r.title,
      kind: r.kind,
      body: r.body,
      source: r.source,
      updatedAt: r.updatedAt.toISOString()
    }));
  } catch {
    return [];
  }
}
