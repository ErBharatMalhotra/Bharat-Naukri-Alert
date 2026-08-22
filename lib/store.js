import fs from "node:fs/promises";
import path from "node:path";

const DATA_FILE = (...parts) => path.join(process.cwd(), "data", ...parts);
const DB_FILE = () => DATA_FILE("opportunities.json");
const ARCHIVE_DIR = () => DATA_FILE("archive");
const QUARANTINE_DIR = () => DATA_FILE("quarantine");
const STATE_FILE = () => DATA_FILE("state.json");

export async function readDB() {
  try {
    return JSON.parse(await fs.readFile(DB_FILE(), "utf8"));
  } catch {
    return { version: 1, updated_at: null, opportunities: [] };
  }
}

export async function writeDB(db) {
  db.updated_at = new Date().toISOString();
  await fs.mkdir(path.dirname(DB_FILE()), { recursive: true });
  await fs.writeFile(DB_FILE(), JSON.stringify(db, null, 2));
}

export async function archiveSnapshot(db) {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dir = path.join(ARCHIVE_DIR(), y, m);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${y}-${m}-${d}.json`);
  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(file, "utf8")).opportunities;
  } catch {}
  await fs.writeFile(
    file,
    JSON.stringify({ snapshot_date: `${y}-${m}-${d}`, opportunities: db.opportunities }, null, 2)
  );
  return file;
}

export async function quarantine(entry, reason) {
  const qDir = QUARANTINE_DIR();
  await fs.mkdir(qDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(qDir, `${stamp}-${entry.id || entry.content_hash || "entry"}.json`);
  await fs.writeFile(file, JSON.stringify({ quarantined_at: new Date().toISOString(), reason, entry }, null, 2));
  return file;
}

export async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE(), "utf8"));
  } catch {
    return {};
  }
}

export async function writeState(state) {
  await fs.mkdir(path.dirname(STATE_FILE()), { recursive: true });
  await fs.writeFile(STATE_FILE(), JSON.stringify(state, null, 2));
}

export async function appendMemory(kind, record) {
  const dir = path.join(process.cwd(), "memory");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, kind === "mistakes" ? "mistakes.json" : "metrics.json");
  let list = [];
  try {
    list = JSON.parse(await fs.readFile(file, "utf8"));
    if (!Array.isArray(list)) list = [];
  } catch {}
  list.push({ at: new Date().toISOString(), ...record });
  if (list.length > 500) list = list.slice(-500);
  await fs.writeFile(file, JSON.stringify(list, null, 2));
}

export function mergeIntoDB(db, incoming) {
  const byHash = new Map(db.opportunities.map((o) => [o.content_hash, o]));
  const report = { added: [], updated: [], duplicates: 0 };
  for (const e of incoming) {
    const existing = byHash.get(e.content_hash);
    if (!existing) {
      db.opportunities.push(e);
      byHash.set(e.content_hash, e);
      report.added.push(e.id);
    } else {
      const changed =
        existing.deadline !== e.deadline ||
        existing.status !== e.status ||
        existing.title !== e.title;
      if (changed) {
        existing.history = existing.history || [];
        existing.history.push({
          date: new Date().toISOString(),
          change: diffSummary(existing, e),
        });
        existing.title = e.title;
        existing.deadline = e.deadline ?? existing.deadline;
        existing.status = e.status;
        existing.last_verified = e.last_verified;
        if (!existing.details && e.details) {
          existing.details = e.details;
          if (!existing.summary && e.summary) existing.summary = e.summary;
        }
        report.updated.push(existing.id);
      } else {
        existing.last_seen = new Date().toISOString();
        if (!existing.details && e.details) {
          existing.details = e.details;
          if (e.summary && !existing.summary) existing.summary = e.summary;
        }
        report.duplicates++;
      }
    }
  }
  return report;
}

function diffSummary(a, b) {
  const parts = [];
  if (a.deadline !== b.deadline) parts.push(`deadline ${a.deadline || "none"} -> ${b.deadline || "none"}`);
  if (a.status !== b.status) parts.push(`status ${a.status} -> ${b.status}`);
  if (a.title !== b.title) parts.push("title changed");
  return parts.join("; ") || "no change";
}
