import fs from "node:fs/promises";
import path from "node:path";
import { readDB, writeDB, archiveSnapshot, mergeIntoDB } from "../lib/store.js";
import { extractEntry, heuristicEntry } from "../lib/extract.js";
import { providerStatus } from "../lib/llm.js";

const SOURCES_FILE = path.resolve("sources/sources.json");

async function loadSources() {
  const raw = JSON.parse(await fs.readFile(SOURCES_FILE, "utf8"));
  return raw.sources.filter((s) => s.enabled !== false);
}

async function loadScraper(type) {
  const map = {
    rss: "../sources/scrapers/pib-rss.js",
    "html-links": "../sources/scrapers/html-links.js",
  };
  const file = map[type];
  if (!file) throw new Error(`unknown source type: ${type}`);
  return import(file);
}

export async function runScrape({ limitPerSource = 40 } = {}) {
  const sources = await loadSources();
  const db = await readDB();
  const knownLinks = new Set(db.opportunities.map((o) => o.official_link));
  const llmBudget = Number(process.env.LLM_MAX_CALLS ?? 8);
  let llmUsed = 0;
  const report = { started_at: new Date().toISOString(), sources: [], total_added: 0, total_updated: 0, llm_calls: 0 };

  for (const src of sources) {
    const srcReport = { id: src.id, raws: 0, added: 0, updated: 0, skipped_known: 0, errors: [] };
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
      for (const raw of candidates.slice(0, limitPerSource)) {
        // API bachao: pehle dedupe — link DB me hai to extraction/LLM skip
        if (knownLinks.has(raw.link)) {
          srcReport.skipped_known++;
          continue;
        }
        // heuristic-first: category + deadline mil gaye to LLM ki zaroorat nahi
        const heur = heuristicEntry(raw, src);
        if (heur && heur.deadline) {
          entries.push(heur);
          continue;
        }
        if (providerStatus().any && llmUsed < llmBudget) {
          llmUsed++;
          report.llm_calls++;
          const enriched = await extractEntry(raw, src, { useLlm: true });
          if (enriched) entries.push(enriched);
        } else if (heur) {
          entries.push(heur);
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
