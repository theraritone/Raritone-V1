import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_PORT = Number(process.env.RARITONE_API_PORT ?? 8787);

// The browser always talks to a same-origin `/api` path. In dev that is proxied to
// the local orchestration server so a phone on the LAN never runs into CORS and so
// the PWA keeps working from the installed-app origin once deployed.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        // Streaming endpoints (live try-on SSE) must not be buffered.
        configure(proxy) {
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["x-accel-buffering"] = "no";
          });
        },
      },
      "/media": {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: true },
      "/media": { target: `http://127.0.0.1:${API_PORT}`, changeOrigin: true },
    },
  },
  build: {
    target: "es2020",
    sourcemap: true,
  },
});
