import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // 테마 토큰 — globals.css의 CSS 변수(RGB 채널)로 라이트/다크 반전.
        // `/opacity` 수식어 유지를 위해 rgb(var / <alpha-value>) 형태 사용.
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        card: "rgb(var(--card-rgb) / <alpha-value>)",
        panel: "rgb(var(--panel-rgb) / <alpha-value>)",
        // 브랜드: 톤다운 테라코타 오렌지 (VENOM ERP V2.1 UI)
        brand: {
          DEFAULT: "#d9662e",
          strong: "#c2560f",
          soft: "#fbeadd"
        },
        // 레거시 다크 사이드바 팔레트(하위호환 — 신규 셸은 토큰 사용)
        sidebar: {
          DEFAULT: "#1c1b19",
          hover: "#2a2825",
          border: "#2f2d2a",
          sub: "#8f8a83"
        },
        warning: "#b7791f",
        danger: "#b83232"
      }
    }
  },
  plugins: []
};

export default config;
