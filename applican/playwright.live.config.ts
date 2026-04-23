import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
});
