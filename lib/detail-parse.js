import { decodeEntities } from "./rss.js";
import { aggDomainsSync } from "./runtime-config.js";

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

function looksLikeVacancyHeader(cells) {
  const h = cells.join(" ").toLowerCase();
  if (/post\s*date|form\s*name|important date/i.test(h)) return false;
  return /post name|post\s+details|name of post|total\s*(post|vacanc)|vacanc|category wise|eligib|qualification|पद का नाम|कुल पद/i.test(h) && !/^\d/.test(cells[0]);
}

function looksLikeVacancyRow(cells) {
  return cells.slice(1).some((c) => /^\d[\d,]{0,8}$/.test(c.replace(/\s/g, "")) || /post|years?|₹|rs\.?/i.test(c));
}

const STEP_VERB = /\b(visit|click|apply|fill|register|submit|pay|upload|download|read|check|open|login|log ?in|select|complete|keep|take\s+(?:a\s+)?print)\b/i;

export function isStepLike(s = "") {
  const t = String(s).trim();
  if (t.length < 15 || t.length > 220) return false;
  if (/[|]|–\s*out$|\bout\b$/i.test(t)) return false;
  if (!STEP_VERB.test(t)) return false;
  if (/\b(exam calendar|answer key|admit card|result)\b.*\b20\d{2}\b/i.test(t) && !STEP_VERB.test(t.replace(/\b(check|download|read)\b/gi, ""))) return false;
  return true;
}

const SOCIAL_JUNK_HOSTS =
  /facebook\.com|instagram\.com|twitter\.com|x\.com|reddit\.com|pinterest\.|linkedin\.com|youtube\.com|whatsapp\.com|t\.me|telegram|play\.google\.com/i;

function portalDomainSrc() {
  const doms = [...aggDomainsSync()].map((d) => String(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return doms.length ? doms.join("|") : "\\u0000none";
}

function junkLinkHosts() {
  return new RegExp(SOCIAL_JUNK_HOSTS.source + "|" + portalDomainSrc(), "i");
}

const BOILER_RE =
  /skip to content|\bmenu\b(?=\s|$)|home\s+latest job|latest job admit card|admit card results admission|about us terms and conditions|terms and conditions contact us/gi;

const NAV_TAIL_RE = /\bs\s+admit card result answer key syllabus[\s\S]*$|\bregister for job alerts[\s\S]*$|\bemployment news search jobs[\s\S]*$/i;

const PORTAL_JUNK_RE =
  /\bwww\.?\s*[.,]?\s*(?:com|in|net|org)\b\.?|\(\s*(?:com|in|net|org)\s*\)|\(\s*\.?\s*(?:com|in|net|org)?\s*\)|\badvertisements?\b|\badvertise\s+(?:on|here|with us)\b|\bcontact us\b|\bwelcome to\b|\bskip to main content\b|\bsearch for\b|\bmain menu\b/gi;

// "FIND FIND" style portal-name fragments (Sarkari Job Find etc.)
const FIND_RUN_RE = /\b(?:find[\s.:,-]*){2,}/gi;

const NAV_LBL = "(?:admit cards?|answer keys?|admission forms?|offline forms?|online forms?|last dates?|results?|syllabus|important links?)";
const NAV_RUN_RE = new RegExp(`(?:\\bs\\s+)?\\b${NAV_LBL}(?:[\\s,]*${NAV_LBL}){1,}\\b`, "gi");

const BRAND_WORD_PASSES = [
  /\b(?:sarkari|rojgar)\s*(?:results?|ujala|jobs?|naukri|exams?)\s*[®©]?(?=\s|$|[:,])/gi,
  /\bfree\s*jobs?\s*alerts?\b/gi,
  /\bsarkari\s*job\s*find\b/gi,
  /\bsarkari\s*ujaala?\b/gi,
  /\bsarkari\s*exams?\b/gi,
];

function brandPasses() {
  const src = portalDomainSrc();
  return [
    new RegExp(`www\\.(?:${src})(?:[/:?#]|$)`, "gi"),
    new RegExp(`(?:${src})(?:[/:?#]|$)`, "gi"),
    ...BRAND_WORD_PASSES,
  ];
}

export function scrubTitle(t = "") {
  let s = String(t).split(/\n/)[0];
  for (const re of brandPasses()) s = s.replace(re, " ");
  s = s.replace(NAV_TAIL_RE, "");
  return s
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.:,\-–|]+/, "")
    .replace(/[\s.:,\-–|]+$/, "")
    .trim();
}

export function scrubSummary(t = "") {
  let s = String(t);
  for (const re of [...brandPasses(), BOILER_RE]) s = s.replace(re, " ");
  s = s.replace(NAV_TAIL_RE, "");
  s = s.replace(FIND_RUN_RE, " ");
  return s
    .replace(/\b(?:more\s+details\s*)?(?:visit|via)\s*[.:,-]?\s*$/i, "")
    .replace(/\b(?:more details|visit here|read more|check here)\s*[.:,-]?\s*$/i, "")
    .replace(PORTAL_JUNK_RE, " ")
    .replace(NAV_RUN_RE, " ")
    .replace(/(?:\s*,\s*){2,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.:,\-–|]+/, "")
    .replace(/[\s.:,\-–|]+$/, "")
    .trim();
}

// Entry-aware scrub: title-echo + "About Post :" boilerplate hatao (clean-details ke liye)
export function scrubSummaryWithEntry(summary = "", title = "") {
  let s = scrubSummary(summary);
  const ap = s.match(/^(?:[\s\S]*?)about post\s*:\s*/i);
  if (ap && ap[0].length < s.length - 80) s = s.slice(ap[0].length);
  const t = String(title || "").replace(/\s+/g, " ").trim();
  if (t.length >= 20) {
    const head = t.slice(0, Math.min(t.length, 45));
    let guard = 0;
    while (s.toLowerCase().startsWith(head.toLowerCase()) && guard < 3) {
      s = s.slice(t.length > 60 ? head.length : t.length).replace(/^[\s.:,\-–|]+/, "");
      guard++;
    }
  }
  return s.replace(/\s{2,}/g, " ").trim();
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
  if (/^(?:and|for|the|or|of|in|with|all|per)$/i.test(k)) return;
  if (/^short information/i.test(k)) {
    if (!out.summary) out.summary = scrubSummary(v.slice(0, 550));
    return;
  }
  if (DATE_LABEL.test(k) && DATE_VALUE.test(v) && out.dates.length < 8) {
    out.dates.push({ k: k.slice(0, 50), v: v.slice(0, 60) });
  } else if (FEE_LABEL.test(k)) {
    if (out.fee.length < 6) out.fee.push({ k: k.slice(0, 40), v: v.slice(0, 60) });
  } else if (FEE_VALUE.test(v) && /(?:rs\.?|₹|inr)|\/\s*-/i.test(v) && /gen|obc|sc\b|st\b|female|ews|all\b|category|other/i.test(k)) {
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
    const catRe =
      /([A-Z][A-Za-z]{1,12}(?:\s*\/\s*[A-Za-z]{1,8}){0,3})\s*:?\s*(?:(?:rs\.?|₹|inr)\s*(\d[\d,]{0,7})(?:\s*\/\s*-)?|(\d[\d,]{0,7})\s*\/\s*-)/gi;
    while ((fm = catRe.exec(feeWin[1])) && out.fee.length < 6) {
      const cat = fm[1].replace(/\s+/g, " ").trim();
      const amt = fm[2] || fm[3];
      if (!amt) continue;
      // junk categories: connective words jo amount se pehle aa jate hain ("500/- And 250/-")
      if (/^(?:and|for|the|or|of|in|with|all|per|fee|others?)$/i.test(cat)) continue;
      if (/pay|mode|debit|credit|banking|form|date|online|fee/i.test(cat)) continue;
      const v = `${amt}/-`;
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
      if (junkLinkHosts().test(m[1])) continue;
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
          const joined = cells.join(" ");
          if (/post\s*date|form\s*name/i.test(joined)) continue;
          if (!out._vacHeader && looksLikeVacancyHeader(cells)) {
            out._vacHeader = cells.map((c) => c.slice(0, 110));
            continue;
          }
          if (out._vacHeader && !out._vacClosed && looksLikeVacancyRow(cells)) {
            out._vacRows = out._vacRows || [];
            if (out._vacRows.length < 12) out._vacRows.push(cells.map((c) => c.slice(0, 110)));
            continue;
          }
          if (out._vacRows && /total/i.test(joined)) {
            out._vacRows.push(cells.map((c) => c.slice(0, 110)));
            out._vacClosed = true;
            continue;
          }
          if (out.extras.length < 8 && cells.every((c) => c.length <= 90) && !/^https?:/i.test(joined)) {
            out.extras.push({ k: cells[0].slice(0, 40), v: cells.slice(1).join(" — ").slice(0, 90) });
          }
        }
        classifyPair(cells[0], cells[1], out);
      }
    }
    sweepText(stripTags(html), out);
    for (const ol of html.matchAll(/<ol[\s\S]*?<\/ol>/gi)) {
      const before = html.slice(Math.max(0, ol.index - 300), ol.index);
      if (!STEP_CONTEXT.test(before)) continue;
      const lis = [...ol[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => stripTags(x[1])).filter(isStepLike);
      if (lis.length >= 2) {
        out.steps = lis.slice(0, 8);
        break;
      }
    }
    if (!out.steps.length) {
      const howTo = /how to apply[\s\S]{0,80}?([\s\S]{60,600}?)(?:important|apply now|official|$)/i.exec(stripTags(html));
      const seg = howTo?.[1] || "";
      const sents = seg.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => isStepLike(s));
      if (sents.length >= 2) out.steps = sents.slice(0, 6);
    }
    out.vacancy = out._vacRows && out._vacRows.length ? [out._vacHeader, ...out._vacRows] : [];
    delete out._vacHeader;
    delete out._vacRows;
    delete out._vacClosed;
    const text = stripTags(html);
    if (!out.summary) out.summary = summaryFromText(html);
    else out.summary = scrubSummary(out.summary);
    out.education = eduFromText(`${out.summary || ""} ${(out.extras || []).map((x) => `${x.k} ${x.v}`).join(" ")}`);
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
