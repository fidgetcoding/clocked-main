// Runs a TypeScript script with the app's own module setup, so it can import from src/ with the @ alias.
//   node scripts/run-ts.mjs scripts/voice-import.ts <args>
import { createServer } from "vite";

const [script] = process.argv.splice(2, 1);
if (!script) {
  console.error("Usage: node scripts/run-ts.mjs <script.ts> [args]");
  process.exit(1);
}
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom", logLevel: "error", optimizeDeps: { noDiscovery: true } });
try {
  await server.ssrLoadModule(`/${script.replace(/^\.?\//, "")}`);
} finally {
  await server.close();
}
