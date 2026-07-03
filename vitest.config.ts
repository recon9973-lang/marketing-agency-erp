import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/e2e/**", "node_modules/**", "docs/**"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
