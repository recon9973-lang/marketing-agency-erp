"use client";

// 링크를 열면 잠깐 뒤 자동으로 로그인(폼 제출) — 사용자는 클릭 한 번(링크)만 하면 된다.
// JS가 늦거나 꺼져 있어도 화면의 버튼으로 수동 진행 가능(폴백).
import { useEffect, useRef } from "react";

export function AutoSubmit() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const t = setTimeout(() => {
      const form = document.getElementById("invite-form") as HTMLFormElement | null;
      form?.requestSubmit();
    }, 700);
    return () => clearTimeout(t);
  }, []);
  return null;
}
