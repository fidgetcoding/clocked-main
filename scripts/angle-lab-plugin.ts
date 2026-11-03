// The angle lab's save endpoint, on the dev server only. Each finished spot lands on disk as a
// recording punch:confusion can read, and summary.md is rewritten with every spot filmed that day.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { spotById, spotFileName, summaryMarkdown, type LabRow } from "../src/lib/lab/angleSpots";

export const DEFAULT_ANGLE_LAB_DIR = join(homedir(), "WORK/CONDITOR-HANDOFF/angle-tests");

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface SaveRequest {
  date: string;
  row: Omit<LabRow, "file">;
  recording: { format: string; stance: string; frames: unknown[]; segments: unknown[] };
}

export class LabRequestError extends Error {}

const readRows = (folder: string): LabRow[] => {
  const file = join(folder, "summary.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as LabRow[]) : [];
};

/** Every spot saved on this date so far. */
export function sessionRows(root: string, date: string): LabRow[] {
  if (!DATE.test(date)) throw new LabRequestError("Bad date");
  return readRows(join(root, date));
}

/** Writes the recording and rewrites the summary. Only known spots and stances, so no path comes from the page. */
export function saveSpot(root: string, request: SaveRequest): { path: string; summary: string; rows: LabRow[] } {
  const { date, row, recording } = request;
  if (!DATE.test(date ?? "")) throw new LabRequestError("Bad date");
  const spot = spotById(row?.spotId ?? "");
  if (!spot) throw new LabRequestError("Unknown spot");
  if (row.stance !== "orthodox" && row.stance !== "southpaw") throw new LabRequestError("Bad stance");
  if (recording?.format !== "clocked-punch-landmarks" || !Array.isArray(recording.frames) || !Array.isArray(recording.segments)) {
    throw new LabRequestError("Not a recording");
  }

  const folder = join(root, date);
  mkdirSync(folder, { recursive: true });
  const file = spotFileName(spot, row.stance);
  const saved: LabRow = { ...row, file };
  const path = join(folder, file);
  writeFileSync(path, JSON.stringify({ ...recording, lab: saved }));

  // A redo replaces its own row
  const rows = [...readRows(folder).filter((existing) => existing.file !== file), saved];
  writeFileSync(join(folder, "summary.json"), JSON.stringify(rows, null, 2));
  const summary = join(folder, "summary.md");
  writeFileSync(summary, summaryMarkdown(date, rows));
  return { path, summary, rows };
}

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

/** Dev server only: `apply: "serve"` keeps it out of every build. */
export function angleLab(root = process.env.ANGLE_LAB_DIR || DEFAULT_ANGLE_LAB_DIR): Plugin {
  return {
    name: "angle-lab",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__lab/angles", async (req, res) => {
        try {
          const url = new URL(req.url ?? "/", "http://localhost");
          if (req.method === "GET" && url.pathname === "/session") {
            const date = url.searchParams.get("date") ?? "";
            return send(res, 200, { folder: join(root, date), rows: sessionRows(root, date) });
          }
          if (req.method === "POST" && url.pathname === "/save") {
            return send(res, 200, saveSpot(root, JSON.parse(await readBody(req)) as SaveRequest));
          }
          send(res, 404, { error: "Not found" });
        } catch (error) {
          send(res, error instanceof LabRequestError ? 400 : 500, { error: String(error instanceof Error ? error.message : error) });
        }
      });
    },
  };
}
