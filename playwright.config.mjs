import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173/build-arena/",
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
    command: "python3 -m http.server 4173 --directory /tmp/build-arena-pages-smoke",
    url: "http://127.0.0.1:4173/build-arena/",
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
