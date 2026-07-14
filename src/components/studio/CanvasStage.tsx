// 디자인 스튜디오 캔버스 — react-konva 렌더러. react-konva는 브라우저 전용이라
// EditorClient에서 next/dynamic(ssr:false)로만 로드된다.
"use client";

import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Group, Rect, Ellipse, Text, Image as KonvaImage, Transformer, Line } from "react-konva";
import type Konva from "konva";
import type { StudioElement, StudioPage } from "@/domain/studio/schema";
import { computeSnap } from "@/domain/studio/snap";

export type ElementPatch = { id: string; patch: Partial<StudioElement> };

type Props = {
  page: StudioPage;
  scale: number;
  selectedIds: string[];
  onSelect: (id: string | null, additive?: boolean) => void;
  onSelectMany: (ids: string[]) => void;
  onChangeElement: (id: string, patch: Partial<StudioElement>) => void;
  onChangeElements: (patches: ElementPatch[]) => void;
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

// 두 박스가 겹치는지(마퀴 선택 판정).
function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export default function CanvasStage({
  page,
  scale,
  selectedIds,
  onSelect,
  onSelectMany,
  onChangeElement,
  onChangeElements,
  onEditText,
  onReady
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
  // 여러 요소를 함께 드래그할 때 시작 위치 스냅샷.
  const dragState = useRef<{ id: string; ox: number; oy: number; others: { id: string; x: number; y: number }[] } | null>(null);
  // 마퀴(드래그 사각형) 선택 상태.
  const marquee = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    onReady(stageRef.current);
    return () => onReady(null);
  }, [onReady]);

  // 선택 요소(들)에 Transformer(핸들) 부착.
  useEffect(() => {
    const tr = trRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, page]);

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

  // 디자인 좌표계의 포인터 위치(스테이지 스케일 역보정).
  function pointerDesign(): { x: number; y: number } | null {
    const stage = stageRef.current;
    const p = stage?.getPointerPosition();
    if (!p) return null;
    return { x: p.x / scale, y: p.y / scale };
  }

  return (
    <Stage
      ref={stageRef}
      width={page.width * scale}
      height={page.height * scale}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={(e) => {
        // 빈 곳/배경에서 시작 → 마퀴 선택 준비.
        if (e.target === e.target.getStage() || e.target.name() === "bg") {
          const p = pointerDesign();
          if (p) marquee.current = { x: p.x, y: p.y, moved: false };
        }
      }}
      onMouseMove={() => {
        if (!marquee.current) return;
        const p = pointerDesign();
        if (!p) return;
        const dx = Math.abs(p.x - marquee.current.x) * scale;
        const dy = Math.abs(p.y - marquee.current.y) * scale;
        if (dx > 4 || dy > 4) marquee.current.moved = true;
        setMarqueeRect({
          x: Math.min(marquee.current.x, p.x),
          y: Math.min(marquee.current.y, p.y),
          w: Math.abs(p.x - marquee.current.x),
          h: Math.abs(p.y - marquee.current.y)
        });
      }}
      onMouseUp={() => {
        const m = marquee.current;
        marquee.current = null;
        setMarqueeRect(null);
        if (!m) return;
        if (!m.moved) {
          onSelect(null); // 빈 곳 클릭 → 선택 해제
          return;
        }
        const p = pointerDesign();
        if (!p) return;
        const box = { x: Math.min(m.x, p.x), y: Math.min(m.y, p.y), w: Math.abs(p.x - m.x), h: Math.abs(p.y - m.y) };
        const hit = page.elements
          .filter((el) => !el.locked && intersects(box, { x: el.x, y: el.y, w: el.width, h: el.height }))
          .map((el) => el.id);
        onSelectMany(hit);
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
            onClick: (e: Konva.KonvaEventObject<MouseEvent>) => onSelect(el.id, e.evt.shiftKey),
            onTap: () => onSelect(el.id),
            onDragStart: () => {
              // 다중 선택 상태에서 선택된 요소를 잡으면 → 함께 이동 준비.
              if (selectedIds.length > 1 && selectedIds.includes(el.id)) {
                dragState.current = {
                  id: el.id,
                  ox: el.x,
                  oy: el.y,
                  others: page.elements
                    .filter((o) => selectedIds.includes(o.id) && o.id !== el.id)
                    .map((o) => ({ id: o.id, x: o.x, y: o.y }))
                };
              } else {
                dragState.current = null;
              }
            },
            onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
              const node = e.target;
              const ds = dragState.current;
              if (ds && ds.id === el.id) {
                // 다중 이동 — 델타를 나머지 선택 요소에 적용(스냅 없음).
                const dx = node.x() - ds.ox;
                const dy = node.y() - ds.oy;
                for (const o of ds.others) {
                  const n = stageRef.current?.findOne(`#${o.id}`);
                  if (n) { n.x(o.x + dx); n.y(o.y + dy); }
                }
                setGuides({ v: [], h: [] });
                return;
              }
              // 단일 이동 — 스마트 가이드 스냅.
              const others = page.elements
                .filter((o) => o.id !== el.id)
                .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
              const snap = computeSnap(
                { x: node.x(), y: node.y(), width: el.width, height: el.height },
                others,
                { width: page.width, height: page.height },
                6 / scale
              );
              node.x(snap.x);
              node.y(snap.y);
              setGuides({ v: snap.vLines, h: snap.hLines });
            },
            onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
              setGuides({ v: [], h: [] });
              const ds = dragState.current;
              if (ds && ds.id === el.id) {
                const dx = e.target.x() - ds.ox;
                const dy = e.target.y() - ds.oy;
                onChangeElements([
                  { id: el.id, patch: { x: e.target.x(), y: e.target.y() } },
                  ...ds.others.map((o) => ({ id: o.id, patch: { x: o.x + dx, y: o.y + dy } }))
                ]);
                dragState.current = null;
              } else {
                onChangeElement(el.id, { x: e.target.x(), y: e.target.y() });
              }
            },
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

        {/* 스마트 가이드(스냅) 선 — 드래그 중에만 */}
        {guides.v.map((x, i) => (
          <Line key={`v${i}`} points={[x, 0, x, page.height]} stroke="#d9662e" strokeWidth={1 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
        ))}
        {guides.h.map((y, i) => (
          <Line key={`h${i}`} points={[0, y, page.width, y]} stroke="#d9662e" strokeWidth={1 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
        ))}

        {/* 마퀴(드래그 선택) 사각형 */}
        {marqueeRect && (
          <Rect
            x={marqueeRect.x}
            y={marqueeRect.y}
            width={marqueeRect.w}
            height={marqueeRect.h}
            fill="rgba(217,102,46,0.10)"
            stroke="#d9662e"
            strokeWidth={1 / scale}
            dash={[4 / scale, 3 / scale]}
            listening={false}
          />
        )}

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
