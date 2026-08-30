import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Folder is literally `assets /assets` (space after "assets"). Relative aliases
// are treated as npm packages; Vite needs an absolute filesystem path.
const blockPngDir = decodeURI(new URL("./assets /assets", import.meta.url).pathname);

export default defineConfig({
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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
