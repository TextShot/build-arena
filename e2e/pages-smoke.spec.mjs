import { expect, test } from "@playwright/test";

const criticalResourceTypes = new Set(["document", "script", "stylesheet", "image", "font"]);

function captureStartupErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    if (criticalResourceTypes.has(request.resourceType())) {
      errors.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && criticalResourceTypes.has(response.request().resourceType())) {
      errors.push(`response ${response.status()}: ${response.url()}`);
    }
  });
  return errors;
}

test("Build Arena starts from the GitHub Pages base path", async ({ page }) => {
  const errors = captureStartupErrors(page);
  await page.goto("./", { waitUntil: "networkidle" });

  await expect(page.locator(".arena-app-shell")).toBeVisible();
  const canvas = page.locator(".renderer-host canvas");
  await expect(canvas).toHaveCount(1);
  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBeGreaterThan(0);
  expect(bounds?.height).toBeGreaterThan(0);
  await expect(page.locator("#startup-recovery")).toBeHidden();
  expect(errors).toEqual([]);
});

test("plain HTML shows recovery when the Arena bundle cannot load", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route(/\/assets\/main-[^/]+\.js$/, (route) => route.abort());

  await page.goto("./", { waitUntil: "domcontentloaded" });
  const recovery = page.locator("#startup-recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("Build Arena could not start");
  expect(consoleErrors.length).toBeGreaterThan(0);
});

test("plain HTML shows recovery when the Play Space bundle cannot load", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route(/\/assets\/playSpace-[^/]+\.js$/, (route) => route.abort());

  await page.goto("MINECRAFT_3D/index.html", { waitUntil: "domcontentloaded" });
  const recovery = page.locator("#startup-recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("Play Space could not start");
  expect(consoleErrors.length).toBeGreaterThan(0);
});

test("Play Space starts from the GitHub Pages base path", async ({ page }) => {
  const errors = captureStartupErrors(page);
  await page.goto("MINECRAFT_3D/index.html", { waitUntil: "networkidle" });

  const canvas = page.locator("#game");
  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBeGreaterThan(0);
  expect(bounds?.height).toBeGreaterThan(0);
  await expect(page.locator("#hotbar .slot")).toHaveCount(12);
  await expect(page.locator("html")).toHaveAttribute("data-app-ready", "true");
  await expect(page.locator("#space-load")).toBeVisible();
  await expect(page.locator("#startup-recovery")).toBeHidden();
  expect(errors).toEqual([]);
});
