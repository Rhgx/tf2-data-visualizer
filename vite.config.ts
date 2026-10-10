import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative URLs so the build works from any path, e.g. GitHub Pages at /<repo>/.
  base: "./",
  server: { host: "127.0.0.1" },
});
