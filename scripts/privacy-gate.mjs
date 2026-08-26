import fs from "node:fs";
import path from "node:path";
import { loadAllSources, aggDomainsSync } from "../lib/runtime-config.js";

// Privacy gate — fails if any portal domain from the private config appears
// in public files (data, memory, site/dist). Names themselves stay in config.

let doms = [];
try {
  await loadAllSources();
  doms = [...(aggDomainsSync() || [])];
} catch {
  console.log("PRIVACY GATE SKIPPED — sources config unavailable (set SOURCES_JSON or local sources.json)");
  process.exit(0);
}

if (!doms.length) {
  console.log("PRIVACY GATE SKIPPED — no domains configured");
  process.exit(0);
}

const NAMES = new RegExp(`(?:^|[^a-z0-9])${doms.map((d) => String(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}(?:[^a-z0-9]|$)`, "gi");

let leaks = [];
function scan(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) scan(p);
    else if (/\.(json|html|xml|txt|csv|log)$/.test(ent.name)) {
      const c = fs.readFileSync(p, "utf8");
      const matches = [...new Set([...c.matchAll(NAMES)].map((m) => m[0].trim()))];
      if (matches.length) leaks.push(`${p} -> ${matches.join(",")}`);
    }
  }
}

scan("data");
scan("memory");
scan("site/dist");
scan("scripts");

if (leaks.length) {
  console.log(`PRIVACY GATE FAILED — ${leaks.length} files with leaks:\n` + leaks.slice(0, 20).join("\n"));
  process.exit(1);
} else {
  console.log(`PRIVACY GATE PASSED — 0 leaks across ${doms.length} monitored domains`);
}
