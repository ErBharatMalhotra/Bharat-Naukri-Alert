import fs from "node:fs/promises";
import path from "node:path";
import { loadAllSources } from "../lib/runtime-config.js";
import { cleanPrivacyText, deepScrub, deepScrubKeys, prunePrivate, OLD_PREFIX_MAP } from "../lib/privacy.js";
import { orgFromTitle, resolveOrg } from "../lib/org-detect.js";

// One-time / repeatable DB sanitizer: neutralizes source ids, strips portal
// names/URLs from every string, drops private fields. Safe to re-run.

const ID_MAP = {
  "agg-sarkariresult": "src-01",
  "agg-freejobalert": "src-02",
  "agg-rojgarresult": "src-03",
  "agg-sarkarijobfind": "src-04",
  "agg-sarkariujala": "src-05",
  sarkariujala: "src-05",
  sbi: "src-06",
  upsc: "src-07",
  nsp: "src-08",
};

const AGG_ORGS = new Set(["FreeJobAlert", "Sarkari Result", "Rojgar Result", "Sarkari Job Find", "Sarkari Ujala"]);
const GOV_HOST_RE = /\.(?:gov|nic)\.in$|^sbi\.co\.in$|^ibps\.in$/;

function govOnlyUrls(urls = []) {
  return (urls || []).filter((u) => {
    try {
      return GOV_HOST_RE.test(new URL(u).hostname);
    } catch {
      return false;
    }
  });
}

function scrubEntry(e) {
  let changed = false;
  if (ID_MAP[e.source] && e.source !== ID_MAP[e.source]) {
    e.source = ID_MAP[e.source];
    changed = true;
  }
  const beforeUrls = JSON.stringify(e.source_urls || []);
  e.source_urls = govOnlyUrls(e.source_urls);
  if (JSON.stringify(e.source_urls) !== beforeUrls) changed = true;
  if (AGG_ORGS.has(e.org)) {
    e.org = orgFromTitle(e.title || "") || resolveOrg({ title: e.title, official_link: e.official_link }, "");
    changed = true;
  }
  const beforeJson = JSON.stringify(e);
  prunePrivate(e);
  deepScrub(e);
  if (JSON.stringify(e) !== beforeJson) changed = true;
  return changed;
}

async function scrubRedirects(file) {
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const nk = cleanPrivacyText(k).s || k;
    const nv = typeof v === "string" ? cleanPrivacyText(v).s : v;
    if (!nk || !nv) continue;
    out[nk] = nv;
  }
  await fs.writeFile(file, JSON.stringify(out, null, 2) + "\n");
  return { file: "redirects.json", total: Object.keys(out).length, dropped: Object.keys(raw).length - Object.keys(out).length };
}

async function scrubFile(file) {
  const raw = JSON.parse(await fs.readFile(file, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.opportunities;
  let changed = 0;
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (entry && typeof entry === "object" && !Array.isArray(entry) && scrubEntry(entry)) changed++;
    }
  } else {
    if (deepScrub(raw)) changed++;
    if (deepScrubKeys(raw)) changed++;
  }
  await fs.writeFile(file, JSON.stringify(raw, null, 2) + "\n");
  return { file: path.basename(file), total: Array.isArray(list) ? list.length : 1, changed };
}

await loadAllSources();

const targets = ["data/opportunities.json", "data/redirects.json"];
async function walk(dir) {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(p);
    else if (ent.name.endsWith(".json")) targets.push(p);
  }
}
await walk("data/archive");
await walk("memory");

let total = 0;
for (const t of targets) {
  try {
    const r = t.endsWith("redirects.json") ? await scrubRedirects(t) : await scrubFile(t);
    console.log(JSON.stringify(r));
    total += r.changed || 0;
  } catch (err) {
    console.error(`${t}: ${err.message}`);
  }
}
console.log(`done — ${total} changes across ${targets.length} files (map: ${Object.keys(OLD_PREFIX_MAP).length} legacy prefixes known)`);
