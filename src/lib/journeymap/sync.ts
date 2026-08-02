"use client";

// 여정맵 프로젝트 서버 동기화 — 로컬(zustand persist)은 빠른 캐시로 유지하고,
// 서버 DB 를 원본으로 삼는다. 충돌은 updatedAt 기준 최신 우선(LWW).

import { Project } from "./types";

const MIGRATED_KEY = "journeymap-server-sync-v1";
// 방금 만든(5분 이내) 로컬 프로젝트는 아직 서버에 저장되기 전일 수 있으므로 삭제하지 않는다
const FRESH_MS = 5 * 60 * 1000;

export async function pushProject(p: Project): Promise<void> {
  try {
    await fetch("/api/journeymap/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: p }),
    });
  } catch {
    // 오프라인 등 — 로컬에는 남아 있으므로 다음 기회에 다시 저장된다
  }
}

export async function deleteProjectRemote(id: string): Promise<void> {
  try {
    await fetch(`/api/journeymap/projects/${id}`, { method: "DELETE" });
  } catch {
    // 무시 — 서버에 남아도 다음 동기화에서 목록에 다시 나타나므로 사용자가 재삭제 가능
  }
}

export async function fetchProjectRemote(id: string): Promise<Project | null> {
  try {
    const res = await fetch(`/api/journeymap/projects/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data as Project) ?? null;
  } catch {
    return null;
  }
}

/**
 * 서버 목록과 로컬 목록을 병합한다.
 * - 서버에만 있음 → 로컬에 추가
 * - 양쪽에 있음 → updatedAt 이 더 최신인 쪽으로 통일
 * - 로컬에만 있음 → 최초 1회는 서버로 올려 이관하고, 그 이후에는
 *   "다른 기기에서 삭제된 것"으로 보고 로컬에서도 제거(단, 5분 이내 신규는 서버로 올림)
 */
export async function syncProjects(
  local: Project[],
  addProject: (p: Project) => void,
  replaceProject: (id: string, p: Project) => void,
  removeLocal: (id: string) => void
): Promise<{ ok: boolean }> {
  let server: { id: string; updatedAt: number; data: Project }[];
  try {
    const res = await fetch("/api/journeymap/projects");
    if (!res.ok) return { ok: false };
    server = (await res.json()).projects ?? [];
  } catch {
    return { ok: false };
  }

  const localById = new Map(local.map((p) => [p.id, p]));
  const serverIds = new Set(server.map((s) => s.id));
  const migrated = typeof localStorage !== "undefined" && localStorage.getItem(MIGRATED_KEY) === "1";

  for (const s of server) {
    const l = localById.get(s.id);
    if (!l) addProject(s.data);
    else if (s.updatedAt > l.updatedAt) replaceProject(s.id, s.data);
    else if (l.updatedAt > s.updatedAt) void pushProject(l);
  }

  for (const l of local) {
    if (serverIds.has(l.id)) continue;
    if (!migrated || Date.now() - l.updatedAt < FRESH_MS) void pushProject(l);
    else removeLocal(l.id);
  }

  try {
    localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    // localStorage 접근 불가 환경 — 이관 플래그 없이도 동작에는 지장 없음
  }
  return { ok: true };
}
