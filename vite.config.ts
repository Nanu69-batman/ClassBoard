import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // The Firebase SDK lands in one lazily-loaded chunk that only /cr and
    // /admin ever request — students never download it. The default 500 kB
    // warning fires on that chunk, which is expected rather than a regression.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
  },
});
