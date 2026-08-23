#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchText } from "../lib/http.js";
import { parseDetailHtml, scrubSummary } from "../lib/detail-parse.js";

const MAX = Number(process.env.REPARSE_MAX ?? 200);
const DB = path.join(process.cwd(), "data", "opportunities.json");
const db = JSON.parse(readFileSync(DB, "utf8"));

const targets = db.opportunities.filter((e) => e._src_detail_url).slice(0, MAX);
console.log(`Re-parsing ${targets.length} entries with stored detail URLs...`);

let ok = 0, fail = 0;
for (const e of targets) {
  try {
    const html = await fetchText(e._src_detail_url, { timeoutMs: 12000, retries: 1 });
    const parsed = parseDetailHtml(html);
    if (!parsed) { fail++; continue; }
    e.details = parsed;
    if (parsed.education?.length) e.eligibility = { ...(e.eligibility || {}), education: parsed.education };
    else if (e.eligibility?.education?.length && e.extraction === "heuristic") e.eligibility.education = [];
    if (parsed.summary?.length > 60) e.summary = scrubSummary(parsed.summary).slice(0, 280);
    if (e.summary) e.summary = scrubSummary(e.summary);
    if (e.editor_note) e.editor_note = scrubSummary(e.editor_note);
    ok++;
  } catch {
    fail++;
  }
}

db.opportunities.forEach((e) => {
  if (!e._src_detail_url) {
    if (e.summary) e.summary = scrubSummary(e.summary);
    if (e.details?.summary) e.details.summary = scrubSummary(e.details.summary);
  }
});

writeFileSync(DB, JSON.stringify(db, null, 2));
console.log(`Re-parsed OK: ${ok}, failed: ${fail}`);
