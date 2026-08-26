import fs from "node:fs";
import path from "node:path";

const NAMES = /sarkariresult|freejobalert|rojgarresult|sarkarijobfind|sarkariujala|govtjobsalert|mysarkarinaukri|sarkarijobs\.com/i;
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

console.log(leaks.length ? `LEAKS (${leaks.length}):\n` + leaks.slice(0, 15).join("\n") : "PRIVACY GATE PASSED — 0 portal-name leaks in data + memory + site/dist");
