#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { scrubSummary, scrubSummaryWithEntry, scrubTitle, isStepLike } from "../lib/detail-parse.js";
import { loadAllSources } from "../lib/runtime-config.js";

await loadAllSources();
import { parseDateFlexible, extractDeadlineRange, extractDeadlineText } from "../lib/extract.js";

const DB = path.join(process.cwd(), "data", "opportunities.json");
const db = JSON.parse(readFileSync(DB, "utf8"));

let stepsCleaned = 0, vacDropped = 0, eduCleared = 0, sumsCleaned = 0, deadlinesBackfilled = 0, titlesCleaned = 0, linksRelabeled = 0;

const GENERIC_LABEL_RE = /^\s*(click here|click|here|download|direct link|view|link|apply)\s*$/i;

function smartLabel(href) {
  const u = String(href || "").toLowerCase();
  if (/admit[-_]?card|call[-_]?letter|hallticket/.test(u)) return "Admit Card / Call Letter";
  if (/applicationform|apply[-_]?online|applynow|registration|onlineform/.test(u)) return "Apply Online";
  if (/\.pdf(\?|$)/.test(u)) {
    if (/notification|advertisement|press[-_]?note|adv[a-z]*\.pdf/.test(u)) return "Official Notification (PDF)";
    return "Download PDF";
  }
  if (/notification|advertisement|press[-_]?note|detailed/.test(u)) return "Official Notification";
  if (/syllabus/.test(u)) return "Syllabus";
  if (/result/.test(u)) return "Result";
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    const p = new URL(href).pathname.replace(/\/+$/, "");
    if (!p) return "Official Website";
    void host;
    return "View Details";
  } catch {
    return "View Link";
  }
}

const kept = [];
for (const e of db.opportunities) {
  const ct = scrubTitle(e.title || "");
  if (!ct || ct.length < 12) { titlesCleaned++; continue; }
  if (ct !== e.title) { e.title = ct; titlesCleaned++; }
  kept.push(e);
}
db.opportunities = kept;

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

  if (Array.isArray(d.fee) && d.fee.length) {
    const before = d.fee.length;
    d.fee = d.fee.filter((f) => !/^(?:and|for|the|or|of|in|with|all|per)$/i.test(String(f.k || "").trim()));
    d.fee = d.fee.filter((f) => /fee/i.test(f.k) || /(?:rs|₹|inr)|\/\s*-|[.,]\d{2}\b/i.test(f.v));
    if (d.fee.length !== before) sumsCleaned++;
  }

  for (const key of ["summary"]) {
    if (d[key]) { const s = scrubSummaryWithEntry(d[key], e.title); if (s !== d[key]) { d[key] = s; sumsCleaned++; } }
  }
  if (e.summary) e.summary = scrubSummaryWithEntry(e.summary, e.title);
  if (e.editor_note) e.editor_note = scrubSummary(e.editor_note);

  if ((!e.summary || e.summary.length < 60) && d.summary && d.summary.length > e.summary?.length) {
    const s = scrubSummaryWithEntry(d.summary, e.title).slice(0, 240);
    if (s.length >= 60) { e.summary = s; sumsCleaned++; }
  }

  if (Array.isArray(d.links) && d.links.length) {
    let changed = false;
    for (const l of d.links) {
      if (GENERIC_LABEL_RE.test(String(l.t || "")) && l.h) {
        const nl = smartLabel(l.h);
        if (nl && nl !== l.t) { l.t = nl; changed = true; }
      }
    }
    if (changed) linksRelabeled++;
  }

  if (!e.deadline) {
    let dl = null;
    const lastRow = (d.dates || []).find((x) => /last date/i.test(x.k));
    if (lastRow) dl = parseDateFlexible(lastRow.v);
    const hay = `${e.title} ${e.summary || ""}`;
    dl = dl || extractDeadlineText(hay) || extractDeadlineRange(hay);
    if (!dl && e.summary) dl = extractDeadlineRange(e.summary) || extractDeadlineText(e.summary);
    if (dl && /^\d{4}-\d{2}-\d{2}$/.test(dl)) {
      e.deadline = dl;
      e.deadline_source_count = 1;
      deadlinesBackfilled++;
    }
  }
  if (e.deadline && e.status !== "closed") {
    const days = Math.ceil((new Date(`${e.deadline}T23:59:59+05:30`) - Date.now()) / 86400000);
    if (days < 0) e.status = "closed";
    else if (days <= 7) e.status = "closing_soon";
    else if (e.status === "closing_soon") e.status = "open";
  }
}

let redirects = {};
const RED = path.join(process.cwd(), "data", "redirects.json");
try { redirects = JSON.parse(readFileSync(RED, "utf8")); } catch {}

const byLink = new Map();
for (const e of kept) {
  if (!e.official_link) continue;
  const prev = byLink.get(e.official_link);
  if (!prev) { byLink.set(e.official_link, e); continue; }
  const score = (x) => (x.details ? 1 : 0) * 10 + (x.deadline ? 5 : 0) + (x.editor_note ? 3 : 0) + String(x.summary || "").length / 1000;
  const winner = score(e) >= score(prev) ? e : prev;
  const loser = winner === e ? prev : e;
  redirects[loser.id] = winner.id;
  byLink.set(e.official_link, winner);
}
db.opportunities = [...byLink.values()];

writeFileSync(DB, JSON.stringify(db, null, 2));
writeFileSync(RED, JSON.stringify(redirects, null, 2));
console.log(`steps cleaned: ${stepsCleaned}, vacancy tables dropped: ${vacDropped}, education cleared: ${eduCleared}, summaries cleaned: ${sumsCleaned}, deadlines backfilled: ${deadlinesBackfilled}, titles cleaned/removed: ${titlesCleaned}, link sets relabeled: ${linksRelabeled}`);
