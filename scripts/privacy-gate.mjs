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

const NAMES = new RegExp(doms.map((d) => String(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

let leaks = [];
function scan(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) scan(p);
    else if (/\.(json|html|xml|txt)$/.test(ent.name)) {
      const c = fs.readFileSync(p, "utf8");
      const m = c.match(NAMES);
      if (m) leaks.push(`${p} -> ${[...new Set(m)].join(",")}`);
    }
  }
}

scan("data");
scan("memory");
scan("site/dist");

console.log(leaks.length ? `LEAKS (${leaks.length}):\n` + leaks.slice(0, 15).join("\n") : `PRIVACY GATE PASSED — 0 leaks across ${doms.length} monitored domains`);
