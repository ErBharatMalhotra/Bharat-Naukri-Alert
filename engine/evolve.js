import fs from "node:fs/promises";
import path from "node:path";
import { readDB } from "../lib/store.js";
import { chatJSON, parseJSONSafe, providerStatus } from "../lib/llm.js";

const REPORTS_DIR = path.resolve("memory/reports");

async function readJSON(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

export async function runEvolution() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const db = await readDB();
  const metrics = await readJSON(path.resolve("memory/metrics.json"), []);
  const mistakes = await readJSON(path.resolve("memory/mistakes.json"), []);
  const lastScrape = await readJSON(path.resolve("memory/last-scrape.json"), {});

  const byCategory = {};
  for (const o of db.opportunities) byCategory[o.category] = (byCategory[o.category] || 0) + 1;

  const stats = {
    total_opportunities: db.opportunities.length,
    by_category: byCategory,
    closing_soon: db.opportunities.filter((o) => o.status === "closing_soon").length,
    quarantine_size: (await fs.readdir(path.resolve("data/quarantine"))).length,
    last_scrape_errors: JSON.stringify(lastScrape.sources || []).match(/"errors":\[[^\]]/g)?.length || 0,
    health_events: metrics.length,
    known_mistakes: mistakes.length,
  };

  const recommendations = [];
  if (stats.quarantine_size > 20) recommendations.push("Quarantine growing: tighten scraper filters or fix extraction prompts");
  if (!stats.by_category.scholarship) recommendations.push("Zero scholarships in DB: check NSP source health or add state scholarship boards to sources.json");
  if (stats.last_scrape_errors > 0) recommendations.push("Scrape errors detected: review dead scrapers and update selectors/config");

  let llmReview = null;
  if (providerStatus().any) {
    try {
      const res = await chatJSON(
        `You are the self-evolution reviewer of an autonomous data engine. Given weekly stats, return JSON {"analysis": string, "actions": string[]} with max 5 concrete actions.`,
        JSON.stringify(stats)
      );
      llmReview = parseJSONSafe(res.text);
    } catch (err) {
      llmReview = { analysis: `LLM review failed: ${err.message}`, actions: [] };
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    stats,
    rule_based_recommendations: recommendations.length ? recommendations : ["System healthy; no action needed"],
    llm_review: llmReview,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const file = path.join(REPORTS_DIR, `evolution-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1].endsWith("evolve.js")) {
  console.log(JSON.stringify(await runEvolution(), null, 2));
}
