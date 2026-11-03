// `npm run lab:angles`: starts the dev server and opens the angle lab in Arc.
// Every take saves to ~/WORK/CONDITOR-HANDOFF/angle-tests/<date>/ (ANGLE_LAB_DIR to change it).
import { spawn, execFile } from "node:child_process";

const PORT = process.env.ANGLE_LAB_PORT || "8095";
const URL = `http://localhost:${PORT}/lab/angles`;

const server = spawn("npx", ["vite", "--port", PORT, "--strictPort"], { stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));

const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  const up = await fetch(URL).then((res) => res.ok, () => false);
  if (up) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.log(`\nAngle lab: ${URL}\n`);
execFile("open", ["-a", "Arc", URL], (error) => {
  if (error) console.log(`Could not open Arc (${error.message}). Open ${URL} yourself.`);
});
