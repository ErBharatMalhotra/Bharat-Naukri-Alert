import fs from "node:fs";
const db = JSON.parse(fs.readFileSync("data/opportunities.json", "utf8"));
const agg = db.opportunities.filter((o) => o.source.startsWith("agg-"));
console.log("aggregator entries:", agg.length);

// official-link domain distribution
const domains = {};
for (const o of agg) {
  try {
    const h = new URL(o.official_link).hostname.replace(/^www\./, "");
    domains[h] = (domains[h] || 0) + 1;
  } catch {}
}
console.log("--- official link domains ---");
Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([d, c]) => console.log(`  ${d}: ${c}`));

// aggregator-domain leakage check
const leaked = agg.filter((o) => /sarkariresult|freejobalert|rojgarresult|sarkarijobfind|sarkariujala/i.test(o.official_link));
console.log("aggregator leakage:", leaked.length);

console.log("--- sample entries ---");
agg.slice(0, 8).forEach((o) => {
  let d = "";
  try { d = new URL(o.official_link).hostname; } catch {}
  const st = (o.eligibility?.states || []).join(",");
  console.log(` [${o.category}] ${(o.title || "").slice(0, 48)} | ${d} | ${st}`);
});
