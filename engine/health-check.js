import fs from "node:fs/promises";
import path from "node:path";
import { isUrlAlive } from "../lib/http.js";
import { appendMemory } from "../lib/store.js";

const SOURCES_FILE = path.resolve("sources/sources.json");

export async function runHealthCheck() {
  const raw = JSON.parse(await fs.readFile(SOURCES_FILE, "utf8"));
  const results = [];
  for (const src of raw.sources) {
    if (src.enabled === false) continue;
    const urls = src.urls || [src.url];
    let aliveCount = 0;
    const details = [];
    for (const u of urls) {
      const r = await isUrlAlive(u);
      details.push({ url: u, ...r });
      if (r.alive) aliveCount++;
    }
    const status = aliveCount === 0 ? "dead" : aliveCount < urls.length ? "degraded" : "healthy";
    results.push({ id: src.id, name: src.name, status, alive: aliveCount, total: urls.length });
  }
  await appendMemory("metrics", { type: "health-check", results });
  return results;
}

if (process.argv[1].endsWith("health-check.js")) {
  console.log(JSON.stringify(await runHealthCheck(), null, 2));
}
