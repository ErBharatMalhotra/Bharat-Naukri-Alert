#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchText } from "../lib/http.js";
import { parseDetailHtml, isSparseDetails } from "../lib/detail-parse.js";
import { resolveOrg, orgFromTitle } from "../lib/org-detect.js";

const MAX = Number(process.env.ENRICH_MAX ?? 15);
const DB = path.join(process.cwd(), "data", "opportunities.json");
const db = JSON.parse(readFileSync(DB, "utf8"));
const originalCount = db.opportunities.length;

const sparse = db.opportunities.filter((e) => !e.details && e.official_link && !/\.pdf$/i.test(e.official_link));
console.log(`Sparse entries: ${sparse.length}. Attempting max ${MAX}...`);

const toFix = sparse.slice(0, MAX);
let fixed = 0;

for (const entry of toFix) {
  try {
    const html = await fetchText(entry.official_link, { timeoutMs: 12000, retries: 1 });
    const parsed = parseDetailHtml(html);
    if (parsed && !isSparseDetails(parsed)) {
      entry.details = parsed;
      if (parsed.summary && (!entry.summary || entry.summary.length < 60)) entry.summary = parsed.summary.slice(0, 280);
      fixed++;
    } else {
      console.log(`  thin ${entry.title?.slice(0, 50)}: page parsed but no structured sections`);
    }
  } catch (err) {
    console.log(`  skip ${entry.title?.slice(0,50)}: ${err.message}`);
  }
}

// Minimum-viable pass: koi bhi live entry bilkul khali na lage.
// Honest template summary + official link, jab structured parse na mile.
let minFixed = 0;
for (const entry of db.opportunities) {
  if (entry.status === "closed" || !entry.official_link) continue;
  const hasLinks = Array.isArray(entry.details?.links) && entry.details.links.length > 0;
  if (!entry.summary || entry.summary.length < 60) {
    const org = entry.org && entry.org !== "Government of India" ? `${entry.org} — ` : "";
    entry.summary = `${org}${entry.title}. Check eligibility, application fee and important dates on the official page before applying.`.slice(0, 280);
    minFixed++;
  }
  if (!entry.details) {
    entry.details = {
      dates: [],
      fee: [],
      vacancy: [],
      steps: [],
      links: [{ k: "Official Page", v: entry.official_link }],
      extras: [],
      summary: "",
    };
    minFixed++;
  } else if (!hasLinks && entry.details.links && entry.official_link) {
    entry.details.links.push({ k: "Official Page", v: entry.official_link });
  }
}

db.opportunities.forEach((e) => { e.org = resolveOrg(e, e.org); });
writeFileSync(DB, JSON.stringify(db, null, 2));
console.log(`Enriched ${fixed}/${toFix.length}. Minimum-viable fixes: ${minFixed}. DB unchanged: ${db.opportunities.length === originalCount}`);
