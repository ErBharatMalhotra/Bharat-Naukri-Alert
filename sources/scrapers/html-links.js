import { fetchText, fetchTextViaProxy, politeDelay } from "../../lib/http.js";
import { decodeEntities } from "../../lib/rss.js";

const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF_RE = /href\s*=\s*["']([^"']+)["']/i;

function absolutize(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

const LEAD_JUNK_RE = /^(?:\s*(?:featured|trending|new|hot)\s+)*(?:last\s*date\s*:?\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*)?(?:job\s*post\s*)?/i;
const TAIL_META_RE = /\s+\b(?:org|state|vacancy|department|qualification|advt\s*no)\s*:\s*[^:]{0,40}$/i;
const TAIL_DATE_RE = /\s*\b(?:updated\s*on|last\s*date)\s*:?\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*$/i;
const TAIL_APPLY_RE = /\s+apply\s+(?:online|offline)\s*$/i;
const TAIL_REG_RE = /\s+registration\s+from\b[\s\S]*$/i;

function cleanCardTitle(s = "") {
  let out = String(s).replace(/\s+/g, " ").trim();
  out = out.replace(LEAD_JUNK_RE, "");
  let prev;
  do {
    prev = out;
    out = out.replace(TAIL_META_RE, "").replace(TAIL_DATE_RE, "").replace(TAIL_APPLY_RE, "").replace(TAIL_REG_RE, "");
  } while (out !== prev);
  return out.trim();
}

export function mineLinks(html, baseUrl, keywords) {
  const out = [];
  const seen = new Set();
  let m;
  ANCHOR_RE.lastIndex = 0;
  while ((m = ANCHOR_RE.exec(html)) !== null) {
    const attrs = m[1];
    const inner = cleanCardTitle(decodeEntities(m[2].replace(/<[^>]*>/g, " ")));
    if (!inner || inner.length < 8 || inner.length > 220) continue;
    const lower = inner.toLowerCase();
    if (!keywords.some((k) => lower.includes(k))) continue;
    const hrefMatch = attrs.match(HREF_RE);
    if (!hrefMatch) continue;
    const link = absolutize(hrefMatch[1], baseUrl);
    if (!link || !/^https?:\/\//i.test(link)) continue;
    const key = link.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: inner, description: "", link });
  }
  return out;
}

export async function scrape(source) {
  const errors = [];
  let raws = [];
  let html = null;
  try {
    html = await fetchText(source.url);
  } catch (err) {
    errors.push(`${source.url}: ${err.message}`);
  }
  if (html === null) {
    try {
      html = await fetchTextViaProxy(source.url);
      errors.push(`${source.id || source.url}: fetched via proxy fallback`);
    } catch (err2) {
      errors.push(`${source.id || source.url}: proxy fallback failed — ${err2.message}`);
    }
  }
  if (html) {
    raws = mineLinks(html, source.url, source.keywords || ["notification", "apply", "recruitment", "scholarship"]);
    await politeDelay(3000);
  }
  return { raws: raws.slice(0, 40), errors };
}
