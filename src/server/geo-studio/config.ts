// GEO Studio · M5 — 설정 (원본 config.py의 비-시크릿 부분). AI 키는 P0 LLM 레이어에서 관리.
import { ROI_DEFAULTS, roiDefaultsFromEnv, type RoiDefaults } from "./roi";

export type Settings = {
  roi: RoiDefaults;
  geoScoreGate: number; // 게시 최소 GEO 점수(기획안 2.4)
};

export const DEFAULT_SETTINGS: Settings = { roi: ROI_DEFAULTS, geoScoreGate: 70 };

export function settingsFromEnv(env: NodeJS.ProcessEnv = process.env): Settings {
  const g = env.GEO_SCORE_GATE == null ? NaN : Number(env.GEO_SCORE_GATE);
  return { roi: roiDefaultsFromEnv(env), geoScoreGate: Number.isFinite(g) ? Math.trunc(g) : 70 };
}
