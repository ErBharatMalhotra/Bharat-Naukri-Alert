import fs from "node:fs/promises";
import { readDB, writeDB, quarantine } from "../lib/store.js";
import { validateEntry, deadlineSanity } from "../lib/schema.js";
import { isUrlAlive } from "../lib/http.js";

const CLOSING_SOON_DAYS = 7;

function withStatus(entry, now) {
  if (!entry.deadline || entry.status === "closed") return entry;
  const d = new Date(`${entry.deadline}T23:59:59+05:30`);
  const days = (d - now) / 86400000;
  if (days < 0) return { ...entry, status: "closed" };
  if (days <= CLOSING_SOON_DAYS && entry.status !== "closing_soon") {
    return { ...entry, status: "closing_soon" };
  }
  return entry;
}

export async function runVerify({ checkLinks = false } = {}) {
  const db = await readDB();
  const now = new Date();
  const kept = [];
  const report = { checked: 0, quarantined: 0, status_flips: 0, link_failures: 0 };

  for (const entry of db.opportunities) {
    report.checked++;
    let current = withStatus(entry, now);
    if (current.status !== entry.status) report.status_flips++;

    const v = validateEntry(current);
    if (!v.valid) {
      await quarantine(current, `schema: ${v.errors.join("; ")}`);
      report.quarantined++;
      continue;
    }
    const sanity = deadlineSanity(current, now);
    if (!sanity.ok && current.status === "open") {
      if (sanity.reason?.startsWith("deadline in past")) {
        current = { ...current, status: "closed" };
      } else {
        await quarantine(current, `sanity: ${sanity.reason}`);
        report.quarantined++;
        continue;
      }
    }
    if (checkLinks && current.official_link) {
      const alive = await isUrlAlive(current.official_link);
      if (!alive.alive) {
        report.link_failures++;
        current.link_check_failed_at = new Date().toISOString();
        current.link_status = alive.status;
      } else {
        delete current.link_check_failed_at;
        current.link_status = alive.status;
      }
    }
    current.last_verified = new Date().toISOString();
    kept.push(current);
  }

  db.opportunities = kept;
  await writeDB(db);
  return report;
}

if (process.argv[1].endsWith("verify.js")) {
  const deep = process.argv.includes("--links");
  const rep = await runVerify({ checkLinks: deep });
  console.log(JSON.stringify(rep, null, 2));
}
