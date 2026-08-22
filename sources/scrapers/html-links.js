import { fetchText, politeDelay } from "../../lib/http.js";
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

export function mineLinks(html, baseUrl, keywords) {
  const out = [];
  const seen = new Set();
  let m;
  ANCHOR_RE.lastIndex = 0;
  while ((m = ANCHOR_RE.exec(html)) !== null) {
    const attrs = m[1];
    const inner = decodeEntities(m[2].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
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
  try {
    const html = await fetchText(source.url);
    raws = mineLinks(html, source.url, source.keywords || ["notification", "apply", "recruitment", "scholarship"]);
    await politeDelay(3000);
  } catch (err) {
    errors.push(`${source.url}: ${err.message}`);
  }
  return { raws: raws.slice(0, 40), errors };
}
