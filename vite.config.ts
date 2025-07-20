import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Determine if we're running in Tauri environment
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer()
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: isTauri ? false : undefined,
    hmr: isTauri ? { port: 1421 } : undefined,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      // localhost GraphQL endpoints proxy - catch all proxy-graphql paths
      "/proxy-graphql": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => {
          const newPath = path.replace("/proxy-graphql", "");
          console.log("Path rewrite:", path, "->", newPath);
          return newPath;
        },
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            console.log("Proxy error:", err);
          });
          proxy.on("proxyReq", (proxyReq, req, res) => {
            console.log(
              "Proxying request:",
              req.method,
              req.url,
              "->",
              "localhost:8080" + proxyReq.path
            );
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
            console.log("Proxy response:", proxyRes.statusCode, req.url);
          });
        },
      },
      // General localhost:8080 proxy fallback
      "/api/localhost8080": {
        target: "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/localhost8080/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req, res) => {
            console.log(
              "Fallback proxy request:",
              req.method,
              req.url,
              "->",
              "localhost:8080" + proxyReq.path
            );
          });
        },
      },
    },
  },
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_ENV_*"],
});
