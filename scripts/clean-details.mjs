#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scrubSummary, isStepLike } from "../lib/detail-parse.js";

const DB = path.join(process.cwd(), "data", "opportunities.json");
const db = JSON.parse(readFileSync(DB, "utf8"));

let stepsCleaned = 0, vacDropped = 0, eduCleared = 0, sumsCleaned = 0;

for (const e of db.opportunities) {
  const d = e.details;
  if (!d) continue;

  if (Array.isArray(d.steps) && d.steps.length) {
    const clean = d.steps.filter(isStepLike);
    if (clean.length !== d.steps.length) { stepsCleaned++; d.steps = clean; }
  }

  if (Array.isArray(d.vacancy) && d.vacancy.length) {
    const header = (d.vacancy[0] || []).join(" ");
    if (/post\s*date|form\s*name/i.test(header)) {
      const noticeRows = d.vacancy.slice(1).slice(0, 4);
      for (const r of noticeRows) {
        if (d.extras.length < 8) d.extras.push({ k: String(r[1] || "").slice(0, 40), v: String(r[2] || r[0] || "").slice(0, 90) });
      }
      d.vacancy = [];
      vacDropped++;
    }
  }

  const hay = `${e.title} ${e.summary || ""} ${d.summary || ""}`;
  if (e.eligibility?.education?.length && !/\b(8th|10th|12th|graduate|iti|diploma|b\.?tech|mbbs|intermediate|high school|senior secondary)\b/i.test(hay)) {
    e.eligibility.education = [];
    eduCleared++;
  }

  for (const key of ["summary"]) {
    if (d[key]) { const s = scrubSummary(d[key]); if (s !== d[key]) { d[key] = s; sumsCleaned++; } }
  }
  if (e.summary) e.summary = scrubSummary(e.summary);
  if (e.editor_note) e.editor_note = scrubSummary(e.editor_note);
}

writeFileSync(DB, JSON.stringify(db, null, 2));
console.log(`steps cleaned: ${stepsCleaned}, vacancy tables dropped: ${vacDropped}, education cleared: ${eduCleared}, summaries cleaned: ${sumsCleaned}`);
