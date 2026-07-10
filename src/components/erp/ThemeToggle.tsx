"use client";

// 라이트/다크 테마 토글 — data-theme 속성 + localStorage('theme') 유지.
// 초기 적용은 layout의 무-FOUC 스크립트가 담당하고, 여기서는 마운트 후 현재값을 읽어 동기화.
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* 저장 실패는 무시 */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={theme === "dark" ? "라이트 모드" : "다크 모드"}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card text-ink transition hover:border-brand/40"
    >
      {mounted && theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
