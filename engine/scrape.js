import fs from "node:fs/promises";
import path from "node:path";
import { readDB, writeDB, archiveSnapshot, mergeIntoDB } from "../lib/store.js";
import { extractEntry, heuristicEntry } from "../lib/extract.js";
import { providerStatus } from "../lib/llm.js";
import { resolveOfficialLink } from "../lib/official-link.js";
import { parseDetailHtml } from "../lib/detail-parse.js";

const STATE_HINTS = [
  [/uttar pradesh|\bup\b/, "Uttar Pradesh"],
  [/madhya pradesh|\bmp\b/, "Madhya Pradesh"],
  [/himachal pradesh|\bhp\b/, "Himachal Pradesh"],
  [/andhra pradesh|\bap\b/, "Andhra Pradesh"],
  [/rajasthan|rssb|rsmssb/, "Rajasthan"],
  [/bihar|bpssc?\b/, "Bihar"],
  [/maharashtra|maharashtra\b|maha\b/, "Maharashtra"],
  [/gujarat|gsssb|gpsc/, "Gujarat"],
  [/punjab(?!i)/, "Punjab"],
  [/haryana|hssc|hssc\b/, "Haryana"],
  [/kerala|kpsc-kerala/, "Kerala"],
  [/karnataka|kpsc\b/, "Karnataka"],
  [/tamil ?nadu|tnpsc/, "Tamil Nadu"],
  [/telangana|tslprb|tsp?sc\b/, "Telangana"],
  [/west bengal|wbp?sc\b/, "West Bengal"],
  [/odisha|ossc\b/, "Odisha"],
  [/assam|slprb-assam/, "Assam"],
  [/\bdelhi\b|dsssb/, "Delhi"],
  [/jharkhand|jssc\b/, "Jharkhand"],
  [/chhattisgarh|cg ?vyapam/, "Chhattisgarh"],
  [/uttarakhand|uksssc/, "Uttarakhand"],
];

function statesFromTitle(title = "") {
  const t = String(title).toLowerCase();
  const hits = [];
  for (const [re, name] of STATE_HINTS) {
    const m = t.match(re);
    if (m && !hits.includes(name)) hits.push(name);
  }
  return hits;
}

function normTitle(s = "") {
  return String(s).toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, "");
}

const SOURCES_FILE = path.resolve("sources/sources.json");

async function loadSources() {
  const raw = JSON.parse(await fs.readFile(SOURCES_FILE, "utf8"));
  return raw.sources.filter((s) => s.enabled !== false);
}

async function loadScraper(type) {
  const map = {
    rss: "../sources/scrapers/pib-rss.js",
    "html-links": "../sources/scrapers/html-links.js",
    aggregator: "../sources/scrapers/aggregator.js",
  };
  const file = map[type];
  if (!file) throw new Error(`unknown source type: ${type}`);
  return import(file);
}

export async function runScrape({ limitPerSource = 40 } = {}) {
  const sources = await loadSources();
  const db = await readDB();
  const knownLinks = new Set(db.opportunities.map((o) => o.official_link));
  const seenTitles = new Set(db.opportunities.map((o) => normTitle(o.title)));
  const llmBudget = Number(process.env.LLM_MAX_CALLS ?? 8);
  const resolveMax = Number(process.env.RESOLVE_MAX ?? 25);
  let llmUsed = 0;
  const report = { started_at: new Date().toISOString(), sources: [], total_added: 0, total_updated: 0, llm_calls: 0, resolved: 0 };

  for (const src of sources) {
    const srcReport = { id: src.id, raws: 0, added: 0, updated: 0, skipped_known: 0, dupes: 0, no_official: 0, errors: [] };
    try {
      const scraper = await loadScraper(src.type);
      const { raws, errors } = await scraper.scrape(src);
      srcReport.errors = errors;
      srcReport.raws = raws.length;

      // relevance filter (news-heavy feeds + nav-link junk ke liye)
      let candidates = raws;
      if (Array.isArray(src.filter_keywords) && src.filter_keywords.length) {
        const kw = src.filter_keywords.map((k) => k.toLowerCase());
        candidates = raws.filter((r) => {
          const hay = `${r.title} ${r.description || ""}`.toLowerCase();
          return kw.some((k) => hay.includes(k));
        });
      }
      const exclude = (src.exclude_keywords || []).map((k) => k.toLowerCase());
      if (exclude.length) {
        candidates = candidates.filter((r) => {
          const hay = `${r.title} ${r.description || ""}`.toLowerCase();
          return !exclude.some((k) => hay.includes(k));
        });
      }
      if (src.min_title_len) {
        candidates = candidates.filter((r) => String(r.title).trim().length >= src.min_title_len);
      }
      srcReport.matched = candidates.length;

      const entries = [];
      const perSourceLimit = src.limit || limitPerSource;
      let resolvedThisRun = 0;
      for (const raw of candidates.slice(0, perSourceLimit)) {
        // API bachao: pehle dedupe — link DB me hai to extraction/LLM skip
        if (knownLinks.has(raw.link)) {
          srcReport.skipped_known++;
          continue;
        }
        // cross-source dedupe: same job doosre portal pe bhi ho to ek hi baar
        const nkey = normTitle(raw.title);
        if (nkey && seenTitles.has(nkey)) {
          srcReport.dupes++;
          continue;
        }

        let workRaw = raw;
        let detailHtml = null;
        if (src.resolve_official) {
          if (resolvedThisRun >= resolveMax) continue;
          resolvedThisRun++;
          report.resolved++;
          const res = await resolveOfficialLink(raw.link);
          if (!res || !res.url) {
            srcReport.no_official++;
            seenTitles.add(nkey);
            continue;
          }
          const official = res.url;
          detailHtml = res.html;
          if (knownLinks.has(official)) {
            srcReport.dupes++;
            seenTitles.add(nkey);
            continue;
          }
          workRaw = { ...raw, link: official, _src_detail_url: raw.link };
        }
        seenTitles.add(nkey);

        const attachDetails = (entry) => {
          if (!detailHtml || !entry) return entry;
          const parsed = parseDetailHtml(detailHtml);
          if (parsed) {
            entry.details = parsed;
            if (parsed.summary && !entry.summary) entry.summary = parsed.summary.slice(0, 280);
            if (parsed.education?.length && entry.eligibility) {
              entry.eligibility.education = [...new Set([...(entry.eligibility.education || []), ...parsed.education])];
            }
          }
          return entry;
        };

        const heur = heuristicEntry(workRaw, src);
        if (!heur && !providerStatus().any) continue;
        if (heur && heur.deadline) {
          const tagged = statesFromTitle(heur.title);
          if (tagged.length) heur.eligibility.states = tagged;
          entries.push(attachDetails(heur));
          continue;
        }
        if (providerStatus().any && llmUsed < llmBudget) {
          llmUsed++;
          report.llm_calls++;
          const enriched = await extractEntry(workRaw, src, { useLlm: true });
          if (enriched) {
            if ((enriched.eligibility?.states || []).every((s) => s === "ALL")) {
              const tagged = statesFromTitle(enriched.title);
              if (tagged.length) enriched.eligibility.states = tagged;
            }
            entries.push(attachDetails(enriched));
          }
        } else if (heur) {
          const tagged = statesFromTitle(heur.title);
          if (tagged.length) heur.eligibility.states = tagged;
          entries.push(attachDetails(heur));
        }
      }
      for (const e of entries) knownLinks.add(e.official_link);
      const merge = mergeIntoDB(db, entries);
      srcReport.added = merge.added.length;
      srcReport.updated = merge.updated.length;
      report.total_added += merge.added.length;
      report.total_updated += merge.updated.length;
    } catch (err) {
      srcReport.errors.push(err.message);
    }
    report.sources.push(srcReport);
  }

  await writeDB(db);
  await archiveSnapshot(db);
  report.finished_at = new Date().toISOString();
  report.db_size = db.opportunities.length;

  const memDir = path.resolve("memory");
  await fs.mkdir(memDir, { recursive: true });
  await fs.writeFile(
    path.join(memDir, "last-scrape.json"),
    JSON.stringify(report, null, 2)
  );
  return report;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("scrape.js")) {
  const dry = process.argv.includes("--dry");
  if (dry) {
    console.log(JSON.stringify({ mode: "dry", note: "no writes" }));
  } else {
    const rep = await runScrape();
    console.log(JSON.stringify(rep, null, 2));
  }
}
