const ORG_HINTS = [
  [/\bupsssc\b/i, "UPSSSC"],
  [/\buppsc?\b/i, "UPPSC"],
  [/\brssb\b|\brajasthan (?:staff|subordinate)/i, "Rajasthan RSSB"],
  [/\brsmssb\b/i, "RSMSSB"],
  [/\bmpesb\b|\bmp ?vyapam\b|\bmpp?sc\b(?!f)/i, "MPESB"],
  [/\bcbse\b/i, "CBSE"],
  [/kendriya vidyalaya|\bkvs\b/i, "KVS"],
  [/navodaya|\bnvs\b/i, "NVS"],
  [/state bank of india|\bsbi\b/i, "SBI"],
  [/\bibps\b/i, "IBPS"],
  [/railway recruitment board|\brrb\b/i, "RRB"],
  [/staff selection commission|\bssc\b/i, "SSC"],
  [/union public service commission|\bupsc\b/i, "UPSC"],
  [/\bjssc\b/i, "JSSC"],
  [/\bbpsc\b|bihar public service/i, "BPSC"],
  [/bihar (?:police|ssc)|\bcsbc\b|central selection board/i, "CSBC Bihar"],
  [/\bnta\b|national testing agency/i, "NTA"],
  [/agniveer(?:\s+vayu)?|\bindian air force\b/i, "Indian Air Force"],
  [/indian navy|\bnavy\b/i, "Indian Navy"],
  [/indian army|\barmy\b.*agniveer/i, "Indian Army"],
  [/coal india|\bcil\b/i, "Coal India"],
  [/ongc/i, "ONGC"],
  [/patna high court/i, "Patna High Court"],
  [/allahabad high court/i, "Allahabad High Court"],
  [/\bfci\b|food corporation/i, "FCI"],
  [/\bntpc\b/i, "NTPC"],
  [/\bisro\b/i, "ISRO"],
  [/\bdrdo\b/i, "DRDO"],
  [/post office|india post/i, "India Post"],
  [/\buksssc\b/i, "UKSSSC"],
  [/\bjkssb\b/i, "JKSSB"],
  [/\bdsssb\b/i, "DSSSB"],
  [/rajasthan high court/i, "Rajasthan High Court"],
  [/\bhssc\b|haryana staff selection/i, "HSSC"],
  [/\bpsc\b/i, "State PSC"],
  [/high court/i, "High Court"],
  [/university/i, "University"],
];

export function orgFromTitle(title = "") {
  const t = String(title);
  for (const [re, name] of ORG_HINTS) {
    if (re.test(t)) return name;
  }
  const acronyms = t.match(/\b[A-Z]{2,6}\b/g);
  if (acronyms) {
    for (const a of acronyms) {
      if (!["THE", "AND", "FOR", "ALL", "NEW", "ONLINE", "FORM", "POST", "LAST", "DATE", "OUT", "VACANCY", "RESULT", "NOTIFICATION", "APPLY", "EXAM", "CARD", "ADMIT", "ANSWER", "KEY", "TOTAL", "POSTS", "ITI", "PDF", "CET", "PET", "ORa"].includes(a)) {
        return a;
      }
    }
  }
  return null;
}

function orgFromDomain(link = "") {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    if (/\.gov\.in$|\.nic\.in$/.test(host)) {
      const parts = host.split(".");
      if (parts.length >= 3 && parts[0] !== "www") return parts[0].toUpperCase();
      return parts.slice(-3)[0].toUpperCase();
    }
    if (/sbi\.bank\.in|sbi\.co\.in/.test(host)) return "SBI";
    if (/ibps/.test(host)) return "IBPS";
    if (/digialm/.test(host)) return "Online Exam Portal";
  } catch {}
  return null;
}

export function resolveOrg(entry, fallbackName) {
  const clean = String(fallbackName || "").replace(/\s*\(aggregator\)\s*/i, "").trim() || "Government of India";
  return orgFromTitle(entry.title || "") || orgFromDomain(entry.official_link || "") || clean;
}

export function postsFromDetails(details) {
  if (!details?.vacancy?.length) return null;
  let max = 0;
  let headerSkipped = false;
  for (const row of details.vacancy) {
    for (let i = 1; i < row.length; i++) {
      const num = Number(String(row[i]).replace(/[,\s]/g, "").match(/^\d{2,7}$/)?.[0]);
      if (Number.isFinite(num) && num > max && num < 10000000) max = num;
    }
  }
  void headerSkipped;
  return max > 0 ? max : null;
}

export function feeFromDetails(details) {
  const f = details?.fee?.find((x) => /gen|obc|ews|ur\b/i.test(x.k)) || details?.fee?.[0];
  if (!f) return null;
  const amt = f.v.match(/[\d,]+/);
  return amt ? { text: String(amt[0]).replace(/,/g, ""), symbol: "₹" } : null;
}
