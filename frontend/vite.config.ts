import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dev server proxies API calls to the FastAPI backend (uvicorn on :8000).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/triage": "http://localhost:8000",
      "/corrections": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
