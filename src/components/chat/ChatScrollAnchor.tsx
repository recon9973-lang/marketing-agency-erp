"use client";

import { useEffect, useRef } from "react";

/** 메시지 목록 하단으로 자동 스크롤. */
export function ChatScrollAnchor({ dependency }: { dependency: string | number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, [dependency]);

  return <div ref={ref} />;
}
