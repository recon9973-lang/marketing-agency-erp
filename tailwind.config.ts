import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1c20",
        line: "#e8e7e4",
        surface: "#f6f5f3",
        // 브랜드: 톤다운 테라코타 오렌지 (VENOM ERP V2.1 UI)
        brand: {
          DEFAULT: "#d9662e",
          strong: "#c2560f",
          soft: "#fbeadd"
        },
        // 다크 사이드바 팔레트
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
