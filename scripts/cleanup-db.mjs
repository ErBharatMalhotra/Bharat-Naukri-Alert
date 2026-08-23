#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveOrg } from "../lib/org-detect.js";

const DB = path.join(process.cwd(), "data", "opportunities.json");
const db = JSON.parse(readFileSync(DB, "utf8"));

const JUNK_RE = /^(sarkari[\w\s,®©.-]*){1}$/i;
const JUNK_COMMA = /\bsarkari\b.*\bsarkari\b.*\bsarkari\b/i;
const AGG_NAMES = new Set(["Sarkari Result", "Free Job Alert", "Rojgar Result", "Sarkari Job Find", "Sarkari Ujala"]);

let fixed = 0;
let deleted = 0;

const cleaned = db.opportunities.filter((e) => {
  const t = String(e.title || "").trim();
  if (JUNK_RE.test(t)) { deleted++; return false; }
  if (JUNK_COMMA.test(t)) { deleted++; return false; }
  if (t.length < 12) { deleted++; return false; }
  if (/sarkari[\s,]+(job|result|exam|naukri)[\s,]+sarkari/i.test(t)) { deleted++; return false; }

  const oldOrg = e.org || "";
  if (/aggregator/i.test(oldOrg) || AGG_NAMES.has(oldOrg)) {
    e.org = resolveOrg(e, "");
    if (!e.org || e.org === "Government of India") {
      const link = String(e.official_link || "");
      const host = (() => { try { return new URL(link).hostname; } catch { return ""; }})();
      if (/upsssc/.test(host)) e.org = "UPSSSC";
      else if (/csbc/.test(host)) e.org = "CSBC";
      else if (/rsmssb|rssb/.test(host)) e.org = "Rajasthan RSSB";
      else if (/jssc/.test(host)) e.org = "JSSC";
      else if (/mpesb|vyapam/.test(host)) e.org = "MPESB";
      else if (/ibps/.test(host)) e.org = "IBPS";
      else if (/sbi/.test(host)) e.org = "SBI";
      else e.org = e.org || "Government of India";
    }
    fixed++;
  }
  return true;
});

db.opportunities = cleaned;
writeFileSync(DB, JSON.stringify(db, null, 2));
console.log(`DB cleanup: fixed ${fixed} orgs, deleted ${deleted} junk entries. Total now: ${db.opportunities.length}`);
