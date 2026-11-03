// The angle lab's save endpoint, on the dev server only. A session is one folder, named for the day
// it started. Each finished spot lands in it as a recording punch:confusion can read, summary.md is
// rewritten after every spot, and current.json points at the open session so a later sitting carries on.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { spotById, spotFileName, summaryMarkdown, type LabRow, type LabStance } from "../src/lib/lab/angleSpots";

export const DEFAULT_ANGLE_LAB_DIR = join(homedir(), "WORK/CONDITOR-HANDOFF/angle-tests");

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A session folder: the day it started, with -2, -3 for a second one that day. */
const SESSION = /^\d{4}-\d{2}-\d{2}(-\d+)?$/;

export interface LabSession {
  name: string;
  folder: string;
  stance: LabStance;
  skipped: string[];
  rows: LabRow[];
}

export interface SaveRequest {
  session: string;
  row: Omit<LabRow, "file">;
  recording: { format: string; stance: string; frames: unknown[]; segments: unknown[] };
}

export class LabRequestError extends Error {}

const readJson = <T>(file: string, fallback: T): T => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback);
const writeJson = (file: string, data: unknown) => writeFileSync(file, JSON.stringify(data, null, 2));

const checkName = (name: string) => {
  if (!SESSION.test(name ?? "")) throw new LabRequestError("Bad session");
  return name;
};

function loadSession(root: string, name: string): LabSession {
  const folder = join(root, checkName(name));
  const meta = readJson<{ stance?: LabStance; skipped?: string[] } | null>(join(folder, "session.json"), null);
  if (!meta?.stance) throw new LabRequestError("No such session");
  return { name, folder, stance: meta.stance, skipped: meta.skipped ?? [], rows: readJson<LabRow[]>(join(folder, "summary.json"), []) };
}

/** The session the last sitting left open, or null. */
export function currentSession(root: string): LabSession | null {
  const pointer = readJson<{ session?: string } | null>(join(root, "current.json"), null);
  if (!pointer?.session || !SESSION.test(pointer.session)) return null;
  try {
    return loadSession(root, pointer.session);
  } catch {
    return null;
  }
}

/** A new session in a fresh folder, which becomes the one to carry on. */
export function startSession(root: string, date: string, stance: LabStance): LabSession {
  if (!DATE.test(date ?? "")) throw new LabRequestError("Bad date");
  if (stance !== "orthodox" && stance !== "southpaw") throw new LabRequestError("Bad stance");
  let name = date;
  for (let n = 2; existsSync(join(root, name)); n += 1) name = `${date}-${n}`;
  const folder = join(root, name);
  mkdirSync(folder, { recursive: true });
  writeJson(join(folder, "session.json"), { stance, skipped: [], startedAt: new Date().toISOString() });
  writeJson(join(root, "current.json"), { session: name });
  return loadSession(root, name);
}

export function setSkipped(root: string, name: string, spotId: string, skipped: boolean): LabSession {
  if (!spotById(spotId)) throw new LabRequestError("Unknown spot");
  const session = loadSession(root, name);
  const rest = session.skipped.filter((id) => id !== spotId);
  const next = skipped ? [...rest, spotId] : rest;
  writeJson(join(session.folder, "session.json"), { ...readJson(join(session.folder, "session.json"), {}), skipped: next });
  return { ...session, skipped: next };
}

/** Writes the recording and rewrites the summary. Only known spots, so no path comes from the page. */
export function saveSpot(root: string, request: SaveRequest): { path: string; summary: string; session: LabSession } {
  const { row, recording } = request;
  const session = loadSession(root, request.session);
  const spot = spotById(row?.spotId ?? "");
  if (!spot) throw new LabRequestError("Unknown spot");
  if (row.stance !== session.stance) throw new LabRequestError("Stance doesn't match the session");
  if (recording?.format !== "clocked-punch-landmarks" || !Array.isArray(recording.frames) || !Array.isArray(recording.segments)) {
    throw new LabRequestError("Not a recording");
  }

  const file = spotFileName(spot, session.stance);
  const saved: LabRow = { ...row, file };
  const path = join(session.folder, file);
  writeFileSync(path, JSON.stringify({ ...recording, lab: saved }));

  // A redo replaces its own row
  const rows = [...session.rows.filter((existing) => existing.spotId !== spot.id), saved].sort((a, b) => Number(a.spotId) - Number(b.spotId));
  writeJson(join(session.folder, "summary.json"), rows);
  const summary = join(session.folder, "summary.md");
  writeFileSync(summary, summaryMarkdown(session.name, session.stance, rows));
  writeJson(join(root, "current.json"), { session: session.name });
  const updated = { ...session, rows };
  return { path, summary, session: session.skipped.includes(spot.id) ? setSkipped(root, session.name, spot.id, false) : updated };
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
          const path = new URL(req.url ?? "/", "http://localhost").pathname;
          if (req.method === "GET" && path === "/progress") return send(res, 200, { root, session: currentSession(root) });
          if (req.method !== "POST") return send(res, 404, { error: "Not found" });
          const body = JSON.parse(await readBody(req));
          if (path === "/start") return send(res, 200, startSession(root, body.date, body.stance));
          if (path === "/skip") return send(res, 200, setSkipped(root, body.session, body.spotId, body.skipped !== false));
          if (path === "/save") return send(res, 200, saveSpot(root, body as SaveRequest));
          send(res, 404, { error: "Not found" });
        } catch (error) {
          send(res, error instanceof LabRequestError ? 400 : 500, { error: String(error instanceof Error ? error.message : error) });
        }
      });
    },
  };
}
