import fs from "fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Serves MediaPipe's wasm from our own origin at its pinned npm version, without keeping 14 MB of
// binaries in git. Only the SIMD build is shipped: createPoseModel turns away browsers without SIMD.
function mediapipeWasm(): Plugin {
  const files = ["vision_wasm_internal.js", "vision_wasm_internal.wasm"];
  const read = (file: string) =>
    fs.readFileSync(path.resolve(__dirname, "node_modules/@mediapipe/tasks-vision/wasm", file));
  return {
    name: "mediapipe-wasm",
    configureServer(server) {
      server.middlewares.use("/mediapipe/wasm", (req, res, next) => {
        const file = path.basename((req.url ?? "").split("?")[0]);
        if (!files.includes(file)) return next();
        res.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : "text/javascript");
        res.end(read(file));
      });
    },
    generateBundle() {
      for (const file of files) {
        this.emitFile({ type: "asset", fileName: `mediapipe/wasm/${file}`, source: read(file) });
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), mediapipeWasm()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
