import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:3211", viewport: { width: 390, height: 844 } },
  webServer: { command: "npx next start -p 3211", url: "http://localhost:3211", reuseExistingServer: true, timeout: 60_000 },
});
