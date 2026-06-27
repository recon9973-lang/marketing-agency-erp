import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18202f",
        line: "#d8dde8",
        surface: "#f7f8fb",
        brand: "#1f7a68",
        warning: "#b7791f",
        danger: "#b83232"
      }
    }
  },
  plugins: []
};

export default config;
