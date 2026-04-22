import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("monaco-editor") || id.includes("@monaco-editor")) {
            return "editor-vendor";
          }

          if (id.includes("@sentry")) {
            return "observability-vendor";
          }

          if (id.includes("@supabase")) {
            return "backend-vendor";
          }

          if (id.includes("@mui") || id.includes("@emotion") || id.includes("@radix-ui")) {
            return "ui-vendor";
          }

          if (id.includes("posthog-js") || id.includes("@posthog")) {
            return "analytics-vendor";
          }

          if (id.includes("jspdf") || id.includes("opentype.js") || id.includes("@chenglou/pretext")) {
            return "document-vendor";
          }

          if (id.includes("framer-motion") || id.includes("@react-spring") || id.includes("gsap")) {
            return "motion-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
