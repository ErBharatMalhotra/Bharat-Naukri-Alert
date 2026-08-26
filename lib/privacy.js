import { aggDomainsSync, legacyPrefixMap, legacySourceIdMap } from "./runtime-config.js";

// Central privacy layer — portal names/domains must never reach public data.
// All sensitive literals (domains, legacy id prefixes) live ONLY in the
// private sources config (GitHub secret / local untracked file).

const URL_TOKEN = /https?:\/\/[^\s"'<>)\]}]+/gi;

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function domainSrc() {
  const doms = [...(aggDomainsSync() || [])].map(escapeRe);
  return doms.join("|") || "\\u0000none";
}

function domainRe() {
  return new RegExp(`(?:${domainSrc()})`, "i");
}

function bareDomainRe() {
  return new RegExp(`(?:www\\.)?(?:${domainSrc()})(?:\\.(?:com|in|net|org))?\\b`, "gi");
}

export function scrubOldTokens(s) {
  const prefixes = legacyPrefixMap() || {};
  return String(s).replace(new RegExp(`\\b(${Object.keys(prefixes).join("|") || "\\u0000none"})\\b`, "gi"), (m) => prefixes[m.toLowerCase()] || "ox");
}

export function cleanPrivacyText(s) {
  let next = scrubOldTokens(s);
  let changed = next !== s;
  if (domainRe().test(next)) {
    next = next.replace(URL_TOKEN, (u) => (domainRe().test(u) ? "" : u));
    changed = true;
  }
  const stripped = next.replace(bareDomainRe(), " ");
  if (stripped !== next) {
    next = stripped;
    changed = true;
  }
  if (!changed) return { s, changed: false };
  return { s: next.replace(/\s{2,}/g, " ").trim(), changed: true };
}

export function deepScrub(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 8) return false;
  if (Array.isArray(obj)) {
    let ch = false;
    for (let i = obj.length - 1; i >= 0; i--) {
      const v = obj[i];
      if (typeof v === "string") {
        const r = cleanPrivacyText(v);
        if (r.changed) {
          if (!r.s && /^https?:/i.test(v)) {
            obj.splice(i, 1);
            ch = true;
            continue;
          }
          obj[i] = r.s;
          ch = true;
        }
      } else if (v && typeof v === "object") {
        if (deepScrub(v, depth + 1)) ch = true;
      }
    }
    return ch;
  }
  let ch = false;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      const r = cleanPrivacyText(v);
      if (r.changed) {
        obj[k] = r.s;
        ch = true;
      }
    } else if (v && typeof v === "object") {
      if (deepScrub(v, depth + 1)) ch = true;
    }
  }
  return ch;
}

function domKeyJunk(key) {
  return domainRe().test(key);
}

export function deepScrubKeys(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return false;
  let ch = false;
  if (Array.isArray(obj)) {
    for (const v of obj) if (deepScrubKeys(v, depth + 1)) ch = true;
    return ch;
  }
  for (const k of Object.keys(obj)) {
    let key = k;
    const prefixes = legacyPrefixMap() || {};
    const prefixRe = new RegExp(`\\b(${Object.keys(prefixes).join("|") || "\\u0000none"})\\b`, "i");
    if (prefixRe.test(key)) {
      key = scrubOldTokens(key);
      obj[key] = obj[k];
      delete obj[k];
      ch = true;
    }
    if (domKeyJunk(key)) {
      delete obj[key];
      ch = true;
      continue;
    }
    const v = obj[key];
    if (v && typeof v === "object" && deepScrubKeys(v, depth + 1)) ch = true;
  }
  return ch;
}

export function prunePrivate(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 3) return obj;
  if (Array.isArray(obj)) {
    for (const v of obj) prunePrivate(v, depth + 1);
    return obj;
  }
  delete obj._src_detail_url;
  for (const v of Object.values(obj)) prunePrivate(v, depth + 1);
  return obj;
}

export function legacyIdToSourceId() {
  return legacySourceIdMap();
}
