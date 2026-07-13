// 디자인 스튜디오 캔버스 — react-konva 렌더러. react-konva는 브라우저 전용이라
// EditorClient에서 next/dynamic(ssr:false)로만 로드된다.
"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Ellipse, Text, Image as KonvaImage, Transformer } from "react-konva";
import type Konva from "konva";
import type { StudioElement, StudioPage } from "@/domain/studio/schema";

type Props = {
  page: StudioPage;
  scale: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeElement: (id: string, patch: Partial<StudioElement>) => void;
  onEditText: (id: string) => void;
  onReady: (stage: Konva.Stage | null) => void;
};

// data URL/원격 이미지를 HTMLImageElement로 로드해 Konva에 넘긴다.
function URLImage({ el }: { el: Extract<StudioElement, { type: "image" }> }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = el.src;
    return () => {
      i.onload = null;
    };
  }, [el.src]);
  return (
    <KonvaImage
      image={img ?? undefined}
      width={el.width}
      height={el.height}
      cornerRadius={el.cornerRadius}
    />
  );
}

export default function CanvasStage({
  page,
  scale,
  selectedId,
  onSelect,
  onChangeElement,
  onEditText,
  onReady
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    onReady(stageRef.current);
    return () => onReady(null);
  }, [onReady]);

  // 선택 요소에 Transformer(핸들) 부착.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const node = selectedId ? stage.findOne(`#${selectedId}`) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, page]);

  function commitTransform(id: string, node: Konva.Node, base: StudioElement) {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChangeElement(id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width: Math.max(5, base.width * scaleX),
      height: Math.max(5, base.height * scaleY)
    });
  }

  return (
    <Stage
      ref={stageRef}
      width={page.width * scale}
      height={page.height * scale}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage() || e.target.name() === "bg") onSelect(null);
      }}
    >
      <Layer>
        {/* 배경 */}
        <Rect name="bg" x={0} y={0} width={page.width} height={page.height} fill={page.background} />

        {page.elements.map((el) => {
          const common = {
            id: el.id,
            x: el.x,
            y: el.y,
            rotation: el.rotation,
            opacity: el.opacity,
            draggable: !el.locked,
            onClick: () => onSelect(el.id),
            onTap: () => onSelect(el.id),
            onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
              onChangeElement(el.id, { x: e.target.x(), y: e.target.y() }),
            onTransformEnd: (e: Konva.KonvaEventObject<Event>) => commitTransform(el.id, e.target, el)
          };

          if (el.type === "text") {
            return (
              <Group key={el.id} {...common} onDblClick={() => onEditText(el.id)} onDblTap={() => onEditText(el.id)}>
                <Text
                  text={el.text}
                  width={el.width}
                  fontSize={el.fontSize}
                  fontFamily={el.fontFamily}
                  fontStyle={el.fontStyle}
                  fill={el.fill}
                  align={el.align}
                  lineHeight={el.lineHeight}
                  letterSpacing={el.letterSpacing}
                />
              </Group>
            );
          }
          if (el.type === "rect") {
            return (
              <Group key={el.id} {...common}>
                <Rect
                  width={el.width}
                  height={el.height}
                  fill={el.fill}
                  cornerRadius={el.cornerRadius}
                  stroke={el.stroke ?? undefined}
                  strokeWidth={el.strokeWidth}
                />
              </Group>
            );
          }
          if (el.type === "ellipse") {
            return (
              <Group key={el.id} {...common}>
                <Ellipse
                  x={el.width / 2}
                  y={el.height / 2}
                  radiusX={el.width / 2}
                  radiusY={el.height / 2}
                  fill={el.fill}
                  stroke={el.stroke ?? undefined}
                  strokeWidth={el.strokeWidth}
                />
              </Group>
            );
          }
          if (el.type === "image") {
            return (
              <Group key={el.id} {...common}>
                <URLImage el={el} />
              </Group>
            );
          }
          return null;
        })}

        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          ignoreStroke
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
        />
      </Layer>
    </Stage>
  );
}
