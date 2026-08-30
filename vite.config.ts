import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@block-png": "assets /assets",
    },
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
