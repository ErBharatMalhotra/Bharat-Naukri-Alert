import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { readDB, writeDB } from "../lib/store.js";
import { resolveOfficialLink } from "../lib/official-link.js";
import { parseDetailHtml, isSparseDetails } from "../lib/detail-parse.js";
import { fetchText } from "../lib/http.js";

const SOURCES_FILE = path.resolve("sources/sources.json");
const normTitle = (s = "") => String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cfg = JSON.parse(await import("node:fs/promises").then((m) => m.readFile(SOURCES_FILE, "utf8")));
const aggSources = cfg.sources.filter((s) => s.resolve_official && s.enabled !== false);
const db = await readDB();
const targets = db.opportunities.filter((o) => o.source?.startsWith("agg-") && isSparseDetails(o.details));
console.log(`targets: ${targets.length} sparse aggregator entries`);

const byTitle = new Map(targets.map((t) => [normTitle(t.title), t]));
let enriched = 0;
let fetched = 0;

for (const src of aggSources) {
  let raws = [];
  try {
    const scraper = await import(
      pathToFileURL(path.resolve(`sources/scrapers/${src.type === "aggregator" ? "aggregator" : "html-links"}.js`)).href
    );
    const res = await scraper.scrape(src);
    raws = res.raws || [];
  } catch (e) {
    console.log(`${src.id}: scrape fail ${e.message.slice(0, 50)}`);
    continue;
  }
  for (const raw of raws) {
    const key = normTitle(raw.title);
    if (!key || !byTitle.has(key)) continue;
    const entry = byTitle.get(key);
    if (!entry._src_detail_url && entry.details && !isSparseDetails(entry.details)) continue;
    if (fetched >= Number(process.env.BACKFILL_MAX ?? 120)) break;
    fetched++;
    await sleep(400);
    try {
      const res = await resolveOfficialLink(raw.link);
      if (!res || !res.url) continue;
      const parsed = parseDetailHtml(res.html);
      if (parsed && !isSparseDetails(parsed)) {
        entry.details = parsed;
        entry._src_detail_url = raw.link;
        if (parsed.summary && !entry.summary) entry.summary = parsed.summary.slice(0, 280);
        if (parsed.education?.length && entry.eligibility) {
          entry.eligibility.education = [...new Set([...(entry.eligibility.education || []), ...parsed.education])];
        }
        enriched++;
        console.log(`+ ${entry.title.slice(0, 55)} [dates:${parsed.dates.length} vac:${parsed.vacancy.length} fee:${parsed.fee.length}]`);
      }
    } catch {}
  }
}

await writeDB(db);
console.log(`done. enriched: ${enriched}/${targets.length}, detail pages fetched: ${fetched}`);
