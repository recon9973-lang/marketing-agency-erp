// 스마트 가이드(스냅) — 순수 계산. 이동 중인 요소의 좌/중앙/우·상/중앙/하를
// 다른 요소·페이지의 같은 기준선에 임계값 내에서 정렬시킨다. (react-konva 무관 → 단위테스트 가능)

export type Box = { x: number; y: number; width: number; height: number };
export type SnapResult = {
  x: number; // 스냅 적용된 좌상단 x
  y: number;
  vLines: number[]; // 세로 가이드가 그려질 x 좌표들
  hLines: number[]; // 가로 가이드가 그려질 y 좌표들
};

// 한 축에서 이동점(3개)과 후보선을 비교해 가장 가까운 스냅(오프셋)과 가이드선을 찾는다.
function snapAxis(start: number, size: number, candidates: number[], threshold: number): { offset: number; lines: number[] } {
  const points = [start, start + size / 2, start + size]; // 좌/중앙/우 (또는 상/중앙/하)
  let best: { diff: number; offset: number; line: number } | null = null;
  for (const p of points) {
    for (const c of candidates) {
      const diff = Math.abs(p - c);
      if (diff <= threshold && (!best || diff < best.diff)) {
        best = { diff, offset: c - p, line: c };
      }
    }
  }
  return best ? { offset: best.offset, lines: [best.line] } : { offset: 0, lines: [] };
}

/**
 * @param moving  이동 중 요소의 박스(디자인 좌표)
 * @param others  다른 요소들의 박스
 * @param page    캔버스 크기
 * @param threshold  스냅 임계값(디자인 px). 보통 6/scale.
 */
export function computeSnap(moving: Box, others: Box[], page: { width: number; height: number }, threshold = 6): SnapResult {
  const vCandidates: number[] = [0, page.width / 2, page.width];
  const hCandidates: number[] = [0, page.height / 2, page.height];
  for (const o of others) {
    vCandidates.push(o.x, o.x + o.width / 2, o.x + o.width);
    hCandidates.push(o.y, o.y + o.height / 2, o.y + o.height);
  }
  const vx = snapAxis(moving.x, moving.width, vCandidates, threshold);
  const hy = snapAxis(moving.y, moving.height, hCandidates, threshold);
  return {
    x: moving.x + vx.offset,
    y: moving.y + hy.offset,
    vLines: vx.lines,
    hLines: hy.lines
  };
}
