import { fetchText } from "./http.js";

const JUNK_HOSTS =
  /facebook\.com|instagram\.com|twitter\.com|x\.com|reddit\.com|quora\.com|pinterest\.|linkedin\.com|wikipedia\.org|t\.me|whatsapp\.com|youtube\.com|play\.google\.com|goo\.gl|bit\.ly|telegram/i;
const AGGREGATOR_HOSTS =
  /sarkariresult|freejobalert|rojgarresult|sarkarijobfind|sarkariujala|sarkariexam|jobriya|sarkarijob/i;

function scoreLink(urlStr, host) {
  const isGov = /(\.|^)(gov|nic)\.in$|[.(]gov\.in|nic\.in/.test(host) || /\.gov\./i.test(host);
  let score = isGov ? 100 : 20;
  if (/apply|registration|login|form|recruit/i.test(urlStr)) score += 15;
  if (/\.pdf$/i.test(urlStr)) score += 10;
  if (/admit|result|answer/i.test(urlStr)) score += 5;
  if (/blog|news|magazine|shop|deal|coupon/i.test(host)) score -= 50;
  return score;
}

export async function resolveOfficialLink(detailUrl, { timeoutMs = 15000 } = {}) {
  try {
    const html = await fetchText(detailUrl, { timeoutMs, retries: 1 });
    let base = null;
    try {
      base = new URL(detailUrl).hostname.replace(/^www\./, "");
    } catch {}
    const cands = [];
    for (const raw of new Set([...html.matchAll(/<a[^>]*href="(https?:\/\/[^"'\s>]+)"/gi)].map((m) => m[1]))) {
      let u;
      try {
        u = new URL(raw.replace(/&amp;/g, "&"));
      } catch {
        continue;
      }
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (base && host === base) continue;
      if (JUNK_HOSTS.test(host)) continue;
      if (AGGREGATOR_HOSTS.test(host)) continue;
      cands.push({ url: u.href.replace(/&amp;/g, "&"), score: scoreLink(u.href, host) });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score);
    return cands[0].score >= 10 ? cands[0].url : null;
  } catch {
    return null;
  }
}
