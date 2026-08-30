import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import { pagesRepoName } from "./scripts/pages-base.mjs";

// Block PNGs live in `assets/assets`. Relative aliases are treated as npm
// packages; Vite needs an absolute filesystem path.
const blockPngDir = decodeURI(new URL("./assets/assets", import.meta.url).pathname);

// Local `npm run dev` / `npm run build` stay at `/`. GitHub Pages is a project
// site: https://USER.github.io/<repo>/ so CI must prefix every asset.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const base = env?.GITHUB_PAGES === "true" ? `/${pagesRepoName()}/` : "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: [{ find: "@block-png", replacement: blockPngDir }],
  },
  optimizeDeps: {
    exclude: ["MINECRAFT_3D/vendor/three.module.js"],
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        playSpace: "MINECRAFT_3D/index.html",
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "MINECRAFT_3D/**/*.test.js"],
  },
});
