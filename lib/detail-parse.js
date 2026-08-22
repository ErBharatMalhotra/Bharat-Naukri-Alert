import { decodeEntities } from "./rss.js";

function stripTags(s = "") {
  return decodeEntities(
    String(s)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
  ).replace(/\s+/g, " ").trim();
}

const DATE_VALUE = /(\d{1,2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{2,4})|(\d{1,2}\s+\w+\s+\d{4})|(\d{1,2}\s*[/-]\s*\d{4})|(before\s+\d{1,2})/i;
const DATE_LABEL = /(apply|begin|start|last date|end date|fee payment|exam|interview|admit ?card|result|correction|reprint|form date|तिथि|तारीख)/i;
const FEE_LABEL = /fee|शुल्क/i;
const FEE_VALUE = /^(rs\.?|inr|₹)?\s*[\d,]{1,9}(\s*\/\s*-)?\s*(only)?$/i;
const AGE_LABEL = /age|birth|उम्र|आयु/i;
const VACANCY_HEADER = /(post|eligib|total|vacanc|qualification|पद)/i;
const STEP_CONTEXT = /(how to apply|application process|mode of apply|आवेदन कैसे)/i;
const EDU_MAP = [
  [/\b(8th|eight)\b.*pass|\b8वीं\b/i, "8th Pass"],
  [/\b10th\b|\bhigh school\b|माध्यमिक/i, "10th Pass"],
  [/\b12th\b|\bintermediate\b|\bsenior secondary\b|इंटरमीडिएट/i, "12th Pass"],
  [/\biti\b|आईटीआई/i, "ITI"],
  [/\bdiploma\b|डिप्लोमा/i, "Diploma"],
  [/graduat|स्नातक|बी\.?ए\b|b\.sc|b\.com/i, "Graduate"],
  [/b\.?\s?tech\b|engineering degree/i, "B.Tech/BE"],
  [/post graduate|m\.tech|m\.sc|m\.com|m\.a\b|एम\.?ए\b/i, "Post Graduate"],
  [/\bmba\b|\bpgdm\b/i, "MBA"],
  [/\bmbbs\b|बीएचएमएस/i, "MBBS"],
];

function eduFromText(text) {
  const hits = [];
  for (const [re, name] of EDU_MAP) {
    if (re.test(text) && !hits.includes(name)) hits.push(name);
  }
  return hits;
}

const JUNK_LINK_HOSTS =
  /facebook\.com|instagram\.com|twitter\.com|x\.com|reddit\.com|pinterest\.|linkedin\.com|youtube\.com|whatsapp\.com|t\.me|telegram|play\.google\.com|sarkariresult|freejobalert|rojgarresult|sarkarijobfind|sarkariujala|sarkariexam|jobriya/i;

export function parseDetailHtml(html) {
  if (!html || html.length < 200) return null;
  const out = { dates: [], fee: [], vacancy: [], steps: [], links: [], extras: [] };
  try {
    for (const m of html.matchAll(/<a[^>]*href="(https?:\/\/[^"'\s>]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const text = stripTags(m[2]);
      if (!text || text.length > 60) continue;
      if (!/(apply online|official website|notification|click here|download|view result|check result)/i.test(text)) continue;
      if (JUNK_LINK_HOSTS.test(m[1])) continue;
      out.links.push({ t: text.slice(0, 40), h: m[1].replace(/&amp;/g, "&") });
      if (out.links.length >= 8) break;
    }
    for (const tb of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
      for (const tr of tb[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
        const cells = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1])).filter(Boolean);
        if (cells.length < 2 || cells.length > 5) continue;
        if (cells.some((c) => c.length > 140)) continue;
        if (cells.length >= 3) {
          if (VACANCY_HEADER.test(cells.join(" ")) && out.vacancy.length < 14) {
            out.vacancy.push(cells.map((c) => c.slice(0, 70)));
          }
          continue;
        }
        const [k, v] = cells;
        if (DATE_LABEL.test(k) && DATE_VALUE.test(v) && out.dates.length < 8) {
          out.dates.push({ k: k.slice(0, 50), v: v.slice(0, 60) });
        } else if (FEE_LABEL.test(k) || (FEE_VALUE.test(v) && /gen|obc|sc|st|female|all|category|other/i.test(k))) {
          if (out.fee.length < 6) out.fee.push({ k: k.slice(0, 40), v: v.slice(0, 60) });
        } else if (AGE_LABEL.test(k) && !out.ageLimit) {
          out.ageLimit = `${k}: ${v}`.slice(0, 120);
        } else if (out.extras.length < 6 && v.length <= 90 && !/^https?:/i.test(v)) {
          out.extras.push({ k: k.slice(0, 40), v: v.slice(0, 90) });
        }
      }
    }
    for (const ol of html.matchAll(/<ol[\s\S]*?<\/ol>/gi)) {
      const before = html.slice(Math.max(0, ol.index - 300), ol.index);
      const lis = [...ol[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => stripTags(x[1])).filter((x) => x.length > 15 && x.length < 220);
      if (lis.length >= 3 && (STEP_CONTEXT.test(before) || out.steps.length === 0)) {
        if (STEP_CONTEXT.test(before)) {
          out.steps = lis.slice(0, 10);
          break;
        }
        if (!out.steps.length) out.steps = lis.slice(0, 10);
      }
    }
    const text = stripTags(html);
    const kw = text.search(/recruit|apply|vacanc|भर्ती|online form/i);
    const start = kw > 120 ? Math.max(0, kw - 100) : 0;
    out.summary = text.slice(start, start + 550).trim();
    out.education = eduFromText(text);
    const ps = text.match(/(?:pay\s*scale|salary)[^.,]{0,80}|₹\s?[\d,]{3,9}\s*(?:-|to)\s*₹?\s?[\d,]{3,9}/i);
    if (ps) out.payScale = ps[0].slice(0, 100);
  } catch {
    return null;
  }
  return out.dates.length || out.fee.length || out.vacancy.length || out.steps.length || out.summary ? out : null;
}

export function isSparseDetails(d) {
  if (!d) return true;
  return !d.dates?.length && !d.vacancy?.length && !d.fee?.length && !d.steps?.length;
}
