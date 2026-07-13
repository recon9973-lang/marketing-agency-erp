// 템플릿 미니 프리뷰 — 문서(StudioDoc 1페이지)를 스케일된 DOM으로 렌더한다.
// 목록 카드용 경량 렌더(Konva 미사용). 텍스트·도형·이미지 근사 표현.
"use client";

import type { StudioDoc, StudioElement } from "@/domain/studio/schema";

export function TemplatePreview({ doc, width }: { doc: StudioDoc; width: number }) {
  const page = doc.pages[0];
  const scale = width / page.width;
  const height = page.height * scale;

  return (
    <div
      className="relative overflow-hidden"
      style={{ width, height, background: page.background }}
      aria-hidden
    >
      {page.elements.map((el) => (
        <ElementView key={el.id} el={el} scale={scale} />
      ))}
    </div>
  );
}

function ElementView({ el, scale }: { el: StudioElement; scale: number }) {
  const base: React.CSSProperties = {
    position: "absolute",
    left: el.x * scale,
    top: el.y * scale,
    width: el.width * scale,
    height: el.height * scale,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: "top left",
    opacity: el.opacity
  };

  if (el.type === "text") {
    return (
      <div
        style={{
          ...base,
          color: el.fill,
          fontSize: el.fontSize * scale,
          fontWeight: el.fontStyle.includes("bold") ? 700 : 400,
          fontStyle: el.fontStyle.includes("italic") ? "italic" : "normal",
          textAlign: el.align,
          lineHeight: el.lineHeight,
          letterSpacing: el.letterSpacing * scale,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          fontFamily: "Pretendard, sans-serif"
        }}
      >
        {el.text}
      </div>
    );
  }
  if (el.type === "rect") {
    return <div style={{ ...base, background: el.fill, borderRadius: el.cornerRadius * scale }} />;
  }
  if (el.type === "ellipse") {
    return <div style={{ ...base, background: el.fill, borderRadius: "50%" }} />;
  }
  if (el.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={el.src} alt="" style={{ ...base, objectFit: "cover", borderRadius: el.cornerRadius * scale }} />
    );
  }
  return null;
}
