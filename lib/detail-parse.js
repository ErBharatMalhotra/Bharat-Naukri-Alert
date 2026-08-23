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

const BOILER_RE =
  /skip to content|sarkari\s*result\s*[®©]?\s*(www\.[a-z0-9.]+)?|www\.sarkariresult\.com|\bmenu\b(?=\s|$)|home\s+latest job|latest job admit card|admit card results admission|about us terms and conditions|terms and conditions contact us/gi;

export function scrubSummary(t = "") {
  return String(t).replace(BOILER_RE, " ").replace(/\s{2,}/g, " ").replace(/^[^\wअ-ह]+/, "").trim();
}

function summaryFromText(html) {
  const text = stripTags(html);
  let seg = "";
  const marker = text.search(/short information|name of post|नाम पद/i);
  if (marker > -1) {
    seg = text.slice(marker);
    const cut = seg.search(/how to apply|important dates|application fee|आवेदन कैसे/i);
    if (cut > 80) seg = seg.slice(0, cut);
  } else {
    const kw = text.search(/recruit|apply online|vacanc|invites?|भर्ती|online form/i);
    seg = kw > 100 ? text.slice(Math.max(0, kw - 80)) : text;
  }
  seg = scrubSummary(seg.slice(0, 700));
  return seg.length > 60 ? seg.slice(0, 550) : scrubSummary(text.slice(0, 550));
}

function classifyPair(k, v, out) {
  k = k.replace(/\s*:\s*$/, "").trim();
  v = v.trim();
  if (!k || !v) return;
  if (/^short information/i.test(k)) {
    if (!out.summary) out.summary = scrubSummary(v.slice(0, 550));
    return;
  }
  if (DATE_LABEL.test(k) && DATE_VALUE.test(v) && out.dates.length < 8) {
    out.dates.push({ k: k.slice(0, 50), v: v.slice(0, 60) });
  } else if (FEE_LABEL.test(k) || (FEE_VALUE.test(v) && /gen|obc|sc|st|female|ews|all|category|other/i.test(k))) {
    if (out.fee.length < 6) out.fee.push({ k: k.slice(0, 40), v: v.slice(0, 60) });
  } else if (/minimum age/i.test(k) || /maximum age/i.test(k)) {
    const min = /(\d{1,3})/.exec(k + " " + v);
    out._ages = out._ages || {};
    if (/min/i.test(k)) out._ages.min = min ? min[1] : "";
    else out._ages.max = min ? min[1] : "";
  } else if (AGE_LABEL.test(k) && !out.ageLimit) {
    out.ageLimit = `${k}: ${v}`.slice(0, 120);
  } else if (out.extras.length < 6 && v.length <= 90 && !/^https?:/i.test(v) && !/sarkari result|www\./i.test(k + v)) {
    out.extras.push({ k: k.slice(0, 40), v: v.slice(0, 90) });
  }
}

function sweepText(text, out) {
  const addDate = (k, v) => {
    if (out.dates.length < 8 && !out.dates.some((d) => d.k.toLowerCase() === k.toLowerCase())) {
      out.dates.push({ k, v });
    }
  };
  let m;
  for (const re of [
    /(?:application begin|apply start|starting date)\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/gi,
    /(?:apply online start|form start)\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/gi,
  ]) {
    while ((m = re.exec(text))) addDate("Application Begin", m[1]);
  }
  while ((m = /last date(?:\s+for apply online|\s+to apply)?\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/gi.exec(text))) {
    addDate("Last Date to Apply", m[1]);
    break;
  }
  while ((m = /(?:pay\s+)?exam fee last date\s*:?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/gi.exec(text))) {
    addDate("Fee Payment Last Date", m[1]);
    break;
  }
  const feeWin = /application fee([\s\S]{0,240}?)(?=(?:important|age limit|how to apply|selection|$))/i.exec(text);
  if (feeWin) {
    let fm;
    const catRe = /([A-Z][A-Za-z]{2,10}(?:\s*\/\s*[A-Za-z]{2,6}){0,3})\s*:?\s*(?:rs\.?|₹|inr)?\s*(\d[\d,]{0,6})\s*(?:\/\s*-)?/g;
    while ((fm = catRe.exec(feeWin[1])) && out.fee.length < 6) {
      const cat = fm[1].replace(/\s+/g, " ").trim();
      if (/pay|mode|debit|credit|banking|form|date|online|fee/i.test(cat)) continue;
      const v = `${fm[2]}/-`;
      if (!out.fee.some((f) => f.k.toLowerCase() === cat.toLowerCase())) out.fee.push({ k: cat.slice(0, 40), v });
    }
  }
  const aMin = /minimum age\s*:?\s*(\d{1,3})\s*years?/i.exec(text);
  const aMax = /maximum age\s*:?\s*(\d{1,3})\s*years?/i.exec(text);
  if ((aMin || aMax) && !out.ageLimit) {
    const asOn = /as on\s+(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i.exec(text);
    out.ageLimit = `Min ${aMin ? aMin[1] : "?"} – Max ${aMax ? aMax[1] : "?"} Years${asOn ? ` (as on ${asOn[1]})` : ""}`.slice(0, 120);
  }
  if (out._ages && !out.ageLimit) {
    out.ageLimit = `Min ${out._ages.min || "?"} – Max ${out._ages.max || "?"} Years`.slice(0, 120);
  }
}

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
        const rawCells2 = [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
        if (!rawCells2.length) continue;

        if (rawCells2.length === 2 && /short information/i.test(stripTags(rawCells2[0][1]))) {
          const sv = stripTags(rawCells2[1][1]);
          if (sv.length > 60 && !out.summary) out.summary = scrubSummary(sv.slice(0, 550));
          continue;
        }

        if (rawCells2.length === 1) {
          const blobHtml = rawCells2[0][1];
          if (blobHtml.length > 6000) continue;
          const lines = blobHtml
            .split(/<br\s*\/?>|\n+/i)
            .map((x) => stripTags(x))
            .filter((x) => x.length > 2 && x.length < 200);
          for (const line of lines) {
            const pm = line.match(/^([^:]{2,50}?)\s*[:：]\s*(.{2,90})$/);
            if (pm) classifyPair(pm[1], pm[2], out);
          }
          continue;
        }

        const cells = rawCells2.map((c) => stripTags(c[1])).filter(Boolean);
        if (cells.length < 2 || cells.length > 5) continue;
        if (cells.some((c) => c.length > 250)) continue;
        if (cells.length >= 3) {
          if (VACANCY_HEADER.test(cells.join(" ")) && out.vacancy.length < 14) {
            out.vacancy.push(cells.map((c) => c.slice(0, 70)));
          }
          continue;
        }
        classifyPair(cells[0], cells[1], out);
      }
    }
    sweepText(stripTags(html), out);
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
    if (!out.summary) out.summary = summaryFromText(html);
    out.education = eduFromText(text);
    const ps = text.match(/(?:pay\s*scale|salary|pay matrix)[^\d]{0,60}(?:₹|rs\.?|inr)?\s?\d[\d,]{2,8}[^\d]{1,6}(?:to|-|₹|rs\.?)?\s?\d[\d,]{2,8}|(?:₹|rs\.?\s?)\d[\d,]{2,8}\s*(?:-|to)\s*(?:₹|rs\.?\s?)\d[\d,]{2,8}/i);
    if (ps && /\d{3}/.test(ps[0]) && !/information|details|click|here|check/i.test(ps[0])) {
      out.payScale = ps[0].slice(0, 100);
    }
  } catch {
    return null;
  }
  return out.dates.length || out.fee.length || out.vacancy.length || out.steps.length || out.summary ? out : null;
}

export function isSparseDetails(d) {
  if (!d) return true;
  return !d.dates?.length && !d.vacancy?.length && !d.fee?.length && !d.steps?.length;
}
