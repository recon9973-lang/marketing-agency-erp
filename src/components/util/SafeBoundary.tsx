"use client";

// 인라인 에러 경계 — 특정 위젯이 실패해도 페이지 전체(상위 error.tsx)를
// 죽이지 않고 조용히 fallback으로 대체한다. (예: 외부 피드 위젯 격리)
import { Component, type ReactNode } from "react";

export class SafeBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[SafeBoundary]", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
