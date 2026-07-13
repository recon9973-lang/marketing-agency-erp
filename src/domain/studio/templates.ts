// 디자인 스튜디오 내장 템플릿 — 코드 정의(관리자 UI·프리뷰 호스팅 없이 즉시 사용).
// 각 템플릿은 실제 요소가 들어간 완성형 문서(StudioDoc)라, 선택 즉시 편집 가능한
// 결과물로 시작된다. 사용자는 텍스트·이미지만 바꾸면 된다.
import { makeId, type StudioDoc, type StudioElement, type TextElement, type ShapeElement } from "@/domain/studio/schema";

export type TemplateCategoryKey = "cardnews" | "sns" | "thumbnail" | "banner" | "popup" | "detail";

export type BuiltinTemplate = {
  id: string;
  category: TemplateCategoryKey;
  title: string;
  kind: string;
  width: number;
  height: number;
  doc: StudioDoc;
};

export const TEMPLATE_CATEGORIES: { key: TemplateCategoryKey; label: string }[] = [
  { key: "cardnews", label: "카드뉴스" },
  { key: "sns", label: "SNS 포스팅" },
  { key: "thumbnail", label: "썸네일" },
  { key: "banner", label: "배너" },
  { key: "popup", label: "팝업" },
  { key: "detail", label: "상세페이지" }
];

// ── 요소 팩토리(기본값 채움) ─────────────────────────────────────
function txt(p: {
  id: string; x: number; y: number; width: number; height: number; text: string; fontSize: number;
  fill?: string; align?: TextElement["align"]; bold?: boolean; lineHeight?: number; letterSpacing?: number;
}): TextElement {
  return {
    id: p.id, type: "text", x: p.x, y: p.y, width: p.width, height: p.height, rotation: 0, opacity: 1, locked: false,
    text: p.text, fontSize: p.fontSize, fontFamily: "Pretendard, sans-serif", fill: p.fill ?? "#111111",
    align: p.align ?? "center", fontStyle: p.bold ? "bold" : "normal", lineHeight: p.lineHeight ?? 1.25, letterSpacing: p.letterSpacing ?? 0
  };
}
function box(p: {
  id: string; type: "rect" | "ellipse"; x: number; y: number; width: number; height: number;
  fill: string; cornerRadius?: number;
}): ShapeElement {
  return {
    id: p.id, type: p.type, x: p.x, y: p.y, width: p.width, height: p.height, rotation: 0, opacity: 1, locked: false,
    fill: p.fill, cornerRadius: p.cornerRadius ?? 0, stroke: null, strokeWidth: 0
  };
}
function page(width: number, height: number, background: string, elements: StudioElement[]): StudioDoc {
  return { version: 1, pages: [{ id: makeId("pg"), width, height, background, elements }] };
}

const BRAND = "#d9662e";
const INK = "#17171b";
const WHITE = "#ffffff";
const MUTED = "#6b7280";

// ── 내장 템플릿 ─────────────────────────────────────────────────
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "cn-cover-dark", category: "cardnews", title: "카드뉴스 표지 · 다크", kind: "cardnews", width: 1080, height: 1350,
    doc: page(1080, 1350, INK, [
      box({ id: "b1", type: "rect", x: 120, y: 470, width: 120, height: 14, fill: BRAND, cornerRadius: 8 }),
      txt({ id: "t1", x: 100, y: 520, width: 880, height: 300, text: "핵심 메시지를\n한 줄로 강하게", fontSize: 96, fill: WHITE, align: "left", bold: true, lineHeight: 1.15 }),
      txt({ id: "t2", x: 100, y: 860, width: 880, height: 80, text: "부제목 · 브랜드/주제를 적어주세요", fontSize: 40, fill: "#c9c9cf", align: "left" }),
      txt({ id: "t3", x: 100, y: 1230, width: 880, height: 50, text: "@브랜드핸들", fontSize: 34, fill: BRAND, align: "left", bold: true })
    ])
  },
  {
    id: "cn-body-light", category: "cardnews", title: "카드뉴스 본문 · 라이트", kind: "cardnews", width: 1080, height: 1350,
    doc: page(1080, 1350, WHITE, [
      txt({ id: "n", x: 100, y: 120, width: 160, height: 120, text: "01", fontSize: 120, fill: BRAND, align: "left", bold: true }),
      txt({ id: "h", x: 100, y: 300, width: 880, height: 160, text: "소제목을 입력하세요", fontSize: 64, fill: INK, align: "left", bold: true }),
      box({ id: "l", type: "rect", x: 100, y: 500, width: 880, height: 4, fill: "#ececed" }),
      txt({ id: "b", x: 100, y: 560, width: 880, height: 600, text: "본문 내용을 입력하세요. 한 장에 한 가지 메시지만 담으면\n가독성이 좋아집니다. 줄바꿈으로 리듬을 만드세요.", fontSize: 44, fill: MUTED, align: "left", lineHeight: 1.5 })
    ])
  },
  {
    id: "sns-sale", category: "sns", title: "인스타 프로모션 · SALE", kind: "sns", width: 1080, height: 1080,
    doc: page(1080, 1080, BRAND, [
      txt({ id: "s", x: 90, y: 150, width: 900, height: 200, text: "SALE", fontSize: 220, fill: WHITE, align: "center", bold: true, letterSpacing: 8 }),
      box({ id: "pill", type: "rect", x: 340, y: 430, width: 400, height: 120, fill: INK, cornerRadius: 60 }),
      txt({ id: "d", x: 340, y: 452, width: 400, height: 90, text: "최대 50% 할인", fontSize: 52, fill: WHITE, align: "center", bold: true }),
      txt({ id: "sub", x: 90, y: 620, width: 900, height: 120, text: "이벤트 기간과 조건을 적어주세요", fontSize: 44, fill: WHITE, align: "center" }),
      box({ id: "cta", type: "rect", x: 360, y: 820, width: 360, height: 110, fill: WHITE, cornerRadius: 55 }),
      txt({ id: "ctat", x: 360, y: 843, width: 360, height: 70, text: "지금 구매하기", fontSize: 42, fill: BRAND, align: "center", bold: true })
    ])
  },
  {
    id: "sns-story-event", category: "sns", title: "인스타 스토리 · 이벤트", kind: "sns", width: 1080, height: 1920,
    doc: page(1080, 1920, INK, [
      box({ id: "top", type: "rect", x: 0, y: 0, width: 1080, height: 520, fill: BRAND }),
      txt({ id: "kicker", x: 90, y: 220, width: 900, height: 70, text: "EVENT", fontSize: 56, fill: WHITE, align: "left", bold: true, letterSpacing: 12 }),
      txt({ id: "title", x: 90, y: 700, width: 900, height: 360, text: "이벤트 제목을\n두 줄로 입력", fontSize: 108, fill: WHITE, align: "left", bold: true, lineHeight: 1.15 }),
      txt({ id: "date", x: 90, y: 1150, width: 900, height: 80, text: "2026.08.01 - 08.15", fontSize: 48, fill: BRAND, align: "left", bold: true }),
      txt({ id: "desc", x: 90, y: 1280, width: 900, height: 300, text: "상세 설명을 적어주세요.\n참여 방법과 혜택을 안내하세요.", fontSize: 44, fill: "#c9c9cf", align: "left", lineHeight: 1.5 })
    ])
  },
  {
    id: "yt-thumb", category: "thumbnail", title: "유튜브 썸네일 · 임팩트", kind: "thumbnail", width: 1280, height: 720,
    doc: page(1280, 720, INK, [
      box({ id: "bar", type: "rect", x: 0, y: 0, width: 22, height: 720, fill: BRAND }),
      txt({ id: "t", x: 80, y: 160, width: 900, height: 420, text: "클릭을 부르는\n제목 한 방", fontSize: 130, fill: WHITE, align: "left", bold: true, lineHeight: 1.1 }),
      box({ id: "hl", type: "rect", x: 80, y: 560, width: 520, height: 70, fill: BRAND, cornerRadius: 10 }),
      txt({ id: "sub", x: 100, y: 573, width: 480, height: 50, text: "핵심 키워드 강조", fontSize: 40, fill: WHITE, align: "left", bold: true })
    ])
  },
  {
    id: "banner-event", category: "banner", title: "가로 배너 · 이벤트", kind: "banner", width: 1200, height: 628,
    doc: page(1200, 628, WHITE, [
      box({ id: "side", type: "rect", x: 0, y: 0, width: 420, height: 628, fill: BRAND }),
      txt({ id: "big", x: 40, y: 230, width: 340, height: 180, text: "50%", fontSize: 150, fill: WHITE, align: "center", bold: true }),
      txt({ id: "h", x: 470, y: 180, width: 680, height: 120, text: "여름 프로모션 오픈", fontSize: 72, fill: INK, align: "left", bold: true }),
      txt({ id: "sub", x: 470, y: 320, width: 680, height: 80, text: "기간 한정 특별가로 만나보세요", fontSize: 40, fill: MUTED, align: "left" }),
      box({ id: "cta", type: "rect", x: 470, y: 430, width: 300, height: 90, fill: INK, cornerRadius: 45 }),
      txt({ id: "ctat", x: 470, y: 450, width: 300, height: 60, text: "자세히 보기", fontSize: 38, fill: WHITE, align: "center", bold: true })
    ])
  },
  {
    id: "popup-coupon", category: "popup", title: "쇼핑몰 팝업 · 쿠폰", kind: "popup", width: 600, height: 800,
    doc: page(600, 800, WHITE, [
      box({ id: "frame", type: "rect", x: 40, y: 40, width: 520, height: 720, fill: "#faf5f1", cornerRadius: 24 }),
      txt({ id: "welcome", x: 80, y: 120, width: 440, height: 70, text: "첫 구매 감사 쿠폰", fontSize: 44, fill: INK, align: "center", bold: true }),
      box({ id: "cbox", type: "rect", x: 100, y: 280, width: 400, height: 160, fill: BRAND, cornerRadius: 16 }),
      txt({ id: "camt", x: 100, y: 310, width: 400, height: 110, text: "10,000원", fontSize: 84, fill: WHITE, align: "center", bold: true }),
      txt({ id: "cond", x: 80, y: 480, width: 440, height: 60, text: "3만원 이상 구매 시 사용 가능", fontSize: 30, fill: MUTED, align: "center" }),
      box({ id: "cta", type: "rect", x: 120, y: 600, width: 360, height: 100, fill: INK, cornerRadius: 50 }),
      txt({ id: "ctat", x: 120, y: 625, width: 360, height: 60, text: "쿠폰 받기", fontSize: 40, fill: WHITE, align: "center", bold: true })
    ])
  },
  {
    id: "detail-section", category: "detail", title: "상세페이지 · 섹션", kind: "detail", width: 860, height: 1200,
    doc: page(860, 1200, WHITE, [
      txt({ id: "eyebrow", x: 80, y: 120, width: 700, height: 50, text: "POINT 01", fontSize: 34, fill: BRAND, align: "left", bold: true, letterSpacing: 4 }),
      txt({ id: "h", x: 80, y: 190, width: 700, height: 130, text: "제품의 핵심 강점", fontSize: 64, fill: INK, align: "left", bold: true }),
      box({ id: "img", type: "rect", x: 80, y: 380, width: 700, height: 460, fill: "#f1f1f3", cornerRadius: 20 }),
      txt({ id: "imgt", x: 80, y: 580, width: 700, height: 60, text: "이미지를 올려 교체하세요", fontSize: 34, fill: "#b8b8be", align: "center" }),
      txt({ id: "b", x: 80, y: 900, width: 700, height: 240, text: "설명 문구를 입력하세요. 고객이 얻는 이점을\n구체적으로 적으면 전환율이 올라갑니다.", fontSize: 38, fill: MUTED, align: "left", lineHeight: 1.5 })
    ])
  }
];

export function getBuiltinTemplate(id: string): BuiltinTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}

/** 템플릿 문서를 새 프로젝트용으로 복제 — 페이지·요소 id를 새로 발급해 충돌 방지. */
export function instantiateTemplateDoc(t: BuiltinTemplate): StudioDoc {
  return {
    version: 1,
    pages: t.doc.pages.map((pg) => ({
      ...pg,
      id: makeId("pg"),
      elements: pg.elements.map((el) => ({ ...el, id: makeId(el.type.slice(0, 2)) }))
    }))
  };
}
