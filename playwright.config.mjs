import { defineConfig, devices } from "@playwright/test";

import { pagesSmokeBaseUrl, pagesSmokeRoot } from "./scripts/pages-base.mjs";

const pagesBaseUrl = pagesSmokeBaseUrl();

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: pagesBaseUrl,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
        },
      },
    },
  ],
  webServer: {
    command: `node scripts/stage-pages.mjs && python3 -m http.server 4173 --directory ${pagesSmokeRoot()}`,
    url: pagesBaseUrl,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
