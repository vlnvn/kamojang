import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
const researchProxy = {
  "/api/research": { target: "http://127.0.0.1:8341", changeOrigin: true },
};
export default defineConfig({
  server: { proxy: researchProxy },
  preview: { proxy: researchProxy },
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
