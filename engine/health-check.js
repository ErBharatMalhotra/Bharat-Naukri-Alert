import { appendMemory } from "../lib/store.js";
import { loadAllSources } from "../lib/runtime-config.js";

export async function runHealthCheck() {
  const sources = await loadAllSources();
  const results = [];
  for (const src of sources) {
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
    results.push({ id: src.id, status, alive: aliveCount, total: urls.length });
  }
  await appendMemory("metrics", { type: "health-check", results });
  return results;
}

if (process.argv[1].endsWith("health-check.js")) {
  console.log(JSON.stringify(await runHealthCheck(), null, 2));
}
