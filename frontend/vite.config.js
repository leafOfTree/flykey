import { resolve } from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ emitCss: false })],
  build: {
    target: "chrome99",
    sourcemap: false,
    minify: "oxc",
    copyPublicDir: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/main.js"),
      formats: ["iife"],
      name: "FlykeyContentScript",
      fileName: () => "index.js",
    },
  },
});
