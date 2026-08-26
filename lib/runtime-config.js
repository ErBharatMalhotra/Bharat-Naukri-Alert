import fs from "node:fs/promises";
import path from "node:path";

// Sources config priority:
//   1) process.env.SOURCES_JSON  (GitHub Actions secret — production)
//   2) sources/sources.json      (local untracked file — development)
// Real portal names/domains live ONLY in the secret or local file.
// The committed repo carries sources.example.json with neutral placeholders.

const FILE = path.resolve("sources/sources.json");

let cache = null;

async function rawConfig() {
  if (cache) return cache;
  if (process.env.SOURCES_JSON && process.env.SOURCES_JSON.trim().startsWith("{")) {
    cache = JSON.parse(process.env.SOURCES_JSON);
    return cache;
  }
  cache = JSON.parse(await fs.readFile(FILE, "utf8"));
  return cache;
}

export async function loadSources() {
  const raw = await rawConfig();
  const list = Array.isArray(raw.sources) ? raw.sources : [];
  if (!list.length) throw new Error("no sources configured (set SOURCES_JSON secret or create sources/sources.json locally)");
  seedFromConfig(raw);
  return list.filter((s) => s.enabled !== false);
}

let syncDomains = new Set();
let syncLegacyIds = {};
let syncLegacyPrefixes = {};

export function seedFromConfig(raw) {
  const all = Array.isArray(raw?.sources) ? raw.sources : [];
  const set = new Set();
  for (const s of all) for (const d of s.domains || []) set.add(String(d).toLowerCase());
  syncDomains = set;
  domainCache = set;
  syncLegacyIds = raw?._legacy_source_ids && typeof raw._legacy_source_ids === "object" ? raw._legacy_source_ids : {};
  syncLegacyPrefixes = raw?._legacy_prefixes && typeof raw._legacy_prefixes === "object" ? raw._legacy_prefixes : {};
}

export function aggDomainsSync() {
  return syncDomains;
}

export function legacySourceIdMap() {
  const out = {};
  for (const [newId, olds] of Object.entries(syncLegacyIds)) {
    for (const o of Array.isArray(olds) ? olds : []) out[String(o)] = newId;
  }
  return out;
}

export function legacyPrefixMap() {
  return syncLegacyPrefixes;
}

export async function loadAllSources() {
  const raw = await rawConfig();
  seedFromConfig(raw);
  return Array.isArray(raw.sources) ? raw.sources : [];
}

let domainCache = null;
export async function aggDomains() {
  if (domainCache) return domainCache;
  const all = await loadAllSources();
  const set = new Set();
  for (const s of all) {
    for (const d of s.domains || []) set.add(String(d).toLowerCase());
  }
  domainCache = set;
  return set;
}

export async function findSource(id) {
  const all = await loadAllSources();
  return all.find((s) => s.id === id) || null;
}