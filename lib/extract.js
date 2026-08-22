import { chatJSON, parseJSONSafe, providerStatus } from "./llm.js";
import { contentHash } from "./schema.js";

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export function parseDateFlexible(text) {
  if (!text) return null;
  const t = String(text).trim();
  let m =
    t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/) ||
    t.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (t.match(/^\d{4}-\d{2}-\d{2}$/)) return t;
  if (m && m.length === 4) {
    const [, d1, d2, y] = [null, ...m.slice(1)];
    const day = Number(d1);
    const month = Number(d2);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const word = t.toLowerCase().match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})[\s,-]+(\d{4})\b/);
  if (word) {
    const day = Number(word[1]);
    const mon = MONTHS[word[2].slice(0, 4)] ?? MONTHS[word[2].slice(0, 3)];
    if (mon && day >= 1 && day <= 31) return `${word[3]}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const wordRev = t.toLowerCase().match(/\b([a-z]{3,9})[\s-]+(\d{1,2})(?:st|nd|rd|th)?,[\s-]*(\d{4})\b/);
  if (wordRev) {
    const mon = MONTHS[wordRev[1].slice(0, 4)] ?? MONTHS[wordRev[1].slice(0, 3)];
    const day = Number(wordRev[2]);
    if (mon && day >= 1 && day <= 31) return `${wordRev[3]}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

const CATEGORY_RULES = [
  ["scholarship", /\bscholarship\b|\bvyaparti\b|\bfellowship\b|\bstipend\b/i],
  ["exam", /\bexam(ination)?\b|\brecruitment exam\b|\bentrance\b|\btier[- ]?[i1]\b|\bmains\b|\bprelims\b/i],
  ["job", /\bvacanc(y|ies)\b|\brecruitment\b|\bbharti\b|\bsarkari naukri\b|\bposts?\b.*\bapply\b/i],
  ["scheme", /\byojana\b|\bscheme\b|\bpm[- ]?\w+\b|\bmission\b/i],
  ["admit-card", /\badmit card\b|\bhall ticket\b/i],
  ["result", /\bresult\b|\bmerit list\b|\bcut ?off\b/i],
];

const DEADLINE_HINTS =
  /(?:last date|deadline|apply (?:by|before|till|on or before)|closing date|submission date|form bhare jane ki antim tarih)[^.\n]{0,80}/i;

export function detectCategory(text) {
  for (const [cat, re] of CATEGORY_RULES) {
    if (re.test(text)) return cat;
  }
  return null;
}

export function extractDeadlineText(text) {
  const m = text.match(DEADLINE_HINTS);
  if (!m) return null;
  const window = text.substr(m.index, 120);
  return parseDateFlexible(window);
}

export function heuristicEntry(raw, sourceMeta) {
  const text = `${raw.title}\n${raw.description || ""}`;
  const category = detectCategory(text) || sourceMeta.default_category || null;
  if (!category) return null;
  const deadline = raw.deadline_hint
    ? parseDateFlexible(raw.deadline_hint)
    : extractDeadlineText(text);
  const entry = {
    id: "",
    content_hash: "",
    title: raw.title.trim(),
    org: sourceMeta.name,
    category,
    eligibility: { education: [], states: ["ALL"] },
    deadline: deadline || null,
    amount: null,
    official_link: raw.link,
    source: sourceMeta.id,
    source_urls: [sourceMeta.url],
    deadline_source_count: deadline ? 1 : 0,
    status: "open",
    first_seen: new Date().toISOString(),
    last_verified: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    history: [],
    summary: (raw.description || "").slice(0, 280),
    extraction: "heuristic",
  };
  entry.content_hash = contentHash(entry);
  entry.id = `${sourceMeta.id}-${entry.content_hash}`;
  return entry;
}

const EXTRACT_SYSTEM = `You are a data extraction engine for Indian government opportunities.
Given raw text from an official announcement, extract ONE JSON object with exactly these fields:
{"title": string (clean English title), "org": issuing organization, "category": one of scholarship|exam|job|scheme|admit-card|result,
"eligibility_education": array of strings like class-10, class-12, graduate, postgraduate, itI, diploma (empty if unknown),
"states": array of Indian state names in English or ["ALL"],
"income_max": number|null, "age_min": number|null, "age_max": number|null,
"deadline": "YYYY-MM-DD"|null (the LAST DATE TO APPLY only),
"amount": string|null (money benefit), "summary": max 250 chars}
Rules: never invent data. If unsure use null. Output ONLY JSON.`;

export async function extractEntry(raw, sourceMeta, { useLlm = true } = {}) {
  const fallback = heuristicEntry(raw, sourceMeta);
  if (!useLlm || !providerStatus().any) return fallback;
  try {
    const prompt = `SOURCE ORG: ${sourceMeta.name}\nURL: ${raw.link}\n\nRAW TEXT:\n${`${raw.title}\n${raw.description || ""}`.slice(0, 4000)}`;
    const res = await chatJSON(EXTRACT_SYSTEM, prompt);
    const parsed = parseJSONSafe(res.text);
    if (!parsed || !parsed.title || !parsed.category) return heuristicEntry(raw, sourceMeta);
    const entry = {
      id: "",
      content_hash: "",
      title: String(parsed.title).slice(0, 300),
      org: parsed.org || sourceMeta.name,
      category: parsed.category,
      eligibility: {
        education: Array.isArray(parsed.eligibility_education) ? parsed.eligibility_education : [],
        states: Array.isArray(parsed.states) && parsed.states.length ? parsed.states : ["ALL"],
        income_max: parsed.income_max ?? null,
        age_min: parsed.age_min ?? null,
        age_max: parsed.age_max ?? null,
      },
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(parsed.deadline || "") ? parsed.deadline : null,
      amount: parsed.amount ?? null,
      official_link: raw.link,
      source: sourceMeta.id,
      source_urls: [sourceMeta.url],
      deadline_source_count: 1,
      status: "open",
      first_seen: new Date().toISOString(),
      last_verified: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      history: [],
      summary: String(parsed.summary || "").slice(0, 300),
      extraction: `llm:${res.provider}`,
    };
    entry.content_hash = contentHash(entry);
    entry.id = `${sourceMeta.id}-${entry.content_hash}`;
    return entry;
  } catch {
    return heuristicEntry(raw, sourceMeta);
  }
}
