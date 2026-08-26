import { aggDomainsSync } from "./runtime-config.js";

// Central privacy layer — portal names/domains must never reach public data.
const STATIC_DOMAINS = [
  "sarkariresult",
  "freejobalert",
  "rojgarresult",
  "sarkarijobfind",
  "sarkariujala",
  "govtjobsalert",
  "mysarkarinaukri",
  "sarkarijobs.com",
];

export const OLD_PREFIX_MAP = {
  "agg-sarkariresult": "o1",
  "agg-freejobalert": "o2",
  "agg-rojgarresult": "o3",
  "agg-sarkarijobfind": "o4",
  "agg-sarkariujala": "o5",
};

const OLD_TOKEN_RE = new RegExp(`\\b(${Object.keys(OLD_PREFIX_MAP).join("|")})\\b`, "gi");
const URL_TOKEN = /https?:\/\/[^\s"'<>)\]}]+/gi;

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function domainSrc() {
  const doms = [...new Set([...STATIC_DOMAINS, ...(aggDomainsSync() || [])])].map(escapeRe);
  return doms.join("|");
}

function bareDomainRe() {
  return new RegExp(`(?:www\\.)?(?:${domainSrc()})(?:\\.(?:com|in|net|org))?\\b`, "gi");
}

const BRAND_PHRASE_RES = [
  /\b(?:sarkari|rojgar)\s*results?\s*[®©]?(?:\s*website)?(?=\s|$|[:,.])/gi,
  /\bfree\s*jobs?\s*alerts?\b/gi,
  /\bsarkari\s*job\s*find\b/gi,
  /\bsarkari\s*ujaala?\b/gi,
  /\bgovt\s*jobs?\s*alerts?\b/gi,
  /\bmy\s*sarkari\s*naukri\b/gi,
];

export function scrubOldTokens(s) {
  return String(s).replace(OLD_TOKEN_RE, (m) => OLD_PREFIX_MAP[m.toLowerCase()] || "ox");
}

export function cleanPrivacyText(s) {
  let next = scrubOldTokens(s);
  let changed = next !== s;
  const domRe = new RegExp(`(?:${domainSrc()})`, "i");
  if (domRe.test(next)) {
    next = next.replace(URL_TOKEN, (u) => (domRe.test(u) ? "" : u));
    changed = true;
  }
  const stripped = next.replace(bareDomainRe(), " ");
  if (stripped !== next) {
    next = stripped;
    changed = true;
  }
  for (const re of BRAND_PHRASE_RES) {
    const s2 = next.replace(re, " ");
    if (s2 !== next) {
      next = s2;
      changed = true;
    }
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

export function deepScrubKeys(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return false;
  let ch = false;
  if (Array.isArray(obj)) {
    for (const v of obj) if (deepScrubKeys(v, depth + 1)) ch = true;
    return ch;
  }
  for (const k of Object.keys(obj)) {
    let key = k;
    if (OLD_TOKEN_RE.test(key)) {
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

function domKeyJunk(key) {
  return new RegExp(`(?:${domainSrc()})`, "i").test(key);
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
