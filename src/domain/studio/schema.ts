// 디자인 스튜디오 문서 스키마 — 캔버스는 해상도 독립 JSON으로 저장한다.
// 저장 좌표는 디자인 단위(px @ 1x). 화면 스케일은 렌더러(Stage)가 처리한다.
import { z } from "zod";

// ── 사이즈 프리셋 ────────────────────────────────────────────────
export type SizePreset = { key: string; label: string; w: number; h: number; kind: StudioKind };
export type StudioKind = "cardnews" | "sns" | "thumbnail" | "popup" | "banner" | "detail" | "blank";

export const SIZE_PRESETS: SizePreset[] = [
  { key: "insta-feed", label: "인스타 피드 (1080×1080)", w: 1080, h: 1080, kind: "sns" },
  { key: "cardnews", label: "카드뉴스 (1080×1350)", w: 1080, h: 1350, kind: "cardnews" },
  { key: "insta-story", label: "인스타 스토리 (1080×1920)", w: 1080, h: 1920, kind: "sns" },
  { key: "yt-thumb", label: "유튜브 썸네일 (1280×720)", w: 1280, h: 720, kind: "thumbnail" },
  { key: "banner", label: "가로 배너 (1200×628)", w: 1200, h: 628, kind: "banner" },
  { key: "popup", label: "쇼핑몰 팝업 (600×800)", w: 600, h: 800, kind: "popup" },
  { key: "detail", label: "상세페이지 섹션 (860×1200)", w: 860, h: 1200, kind: "detail" }
];

// ── 요소(Element) ───────────────────────────────────────────────
const baseElement = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
  // 그룹 지정 — 같은 groupId를 가진 요소들은 한 번의 클릭으로 함께 선택·이동된다.
  // optional(추가 필드) → 기존 저장 문서·요소 리터럴과 하위호환.
  groupId: z.string().nullable().optional()
});

export const textElement = baseElement.extend({
  type: z.literal("text"),
  text: z.string(),
  fontSize: z.number().default(48),
  fontFamily: z.string().default("Pretendard, sans-serif"),
  fill: z.string().default("#111111"),
  align: z.enum(["left", "center", "right"]).default("left"),
  fontStyle: z.string().default("normal"), // "normal" | "bold" | "italic" | "bold italic"
  lineHeight: z.number().default(1.2),
  letterSpacing: z.number().default(0)
});

export const shapeElement = baseElement.extend({
  type: z.enum(["rect", "ellipse"]),
  fill: z.string().default("#d9662e"),
  cornerRadius: z.number().default(0),
  stroke: z.string().nullable().default(null),
  strokeWidth: z.number().default(0)
});

export const imageElement = baseElement.extend({
  type: z.literal("image"),
  src: z.string(), // data URL 또는 원격 URL (MVP: data URL 인라인)
  cornerRadius: z.number().default(0)
});

// z.union(비판별) 사용 — shape가 type: enum("rect"|"ellipse")이라 판별 유니온 대신 안전.
export const studioElement = z.union([textElement, shapeElement, imageElement]);

export const studioPage = z.object({
  id: z.string(),
  width: z.number(),
  height: z.number(),
  background: z.string().default("#ffffff"),
  elements: z.array(studioElement).default([])
});

export const studioDoc = z.object({
  version: z.literal(1).default(1),
  pages: z.array(studioPage).min(1)
});

export type TextElement = z.infer<typeof textElement>;
export type ShapeElement = z.infer<typeof shapeElement>;
export type ImageElement = z.infer<typeof imageElement>;
export type StudioElement = z.infer<typeof studioElement>;
export type StudioPage = z.infer<typeof studioPage>;
export type StudioDoc = z.infer<typeof studioDoc>;

// ── 팩토리 ──────────────────────────────────────────────────────
// 충돌 없는 로컬 id 생성(암호강도 불필요 — 문서 내 유일성만). crypto가 있으면 사용.
let seq = 0;
export function makeId(prefix = "el"): string {
  const c = typeof globalThis !== "undefined" ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (c?.randomUUID) return `${prefix}_${c.randomUUID().slice(0, 8)}`;
  seq += 1;
  return `${prefix}_${seq.toString(36)}_${(performance?.now?.() ?? seq).toString().replace(".", "")}`;
}

export function blankPage(width: number, height: number): StudioPage {
  return { id: makeId("pg"), width, height, background: "#ffffff", elements: [] };
}

export function blankDoc(width: number, height: number): StudioDoc {
  return { version: 1, pages: [blankPage(width, height)] };
}

/** 저장/불러오기 시 알 수 없는 값 방어 — 실패하면 최소 문서로 폴백. */
export function parseDoc(value: unknown, fallbackW = 1080, fallbackH = 1080): StudioDoc {
  const res = studioDoc.safeParse(value);
  if (res.success) return res.data;
  return blankDoc(fallbackW, fallbackH);
}
