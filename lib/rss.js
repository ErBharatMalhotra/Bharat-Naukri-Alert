const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019",
  lsquo: "\u2018", ldquo: "\u201c", rdquo: "\u201d", mdash: "\u2014", ndash: "\u2013",
};

export function decodeEntities(str = "") {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function stripCdata(str = "") {
  return str.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
}

export function stripTags(str = "") {
  return decodeEntities(String(str).replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function tagContent(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? stripCdata(m[1]) : "";
}

function extractLink(itemXml) {
  const linkTag = itemXml.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
  if (linkTag) {
    const val = stripTags(stripCdata(linkTag[1]));
    if (/^https?:\/\//i.test(val)) return val;
  }
  const hrefAttr = itemXml.match(/<link\s[^>]*href=["']([^"']+)["']/i);
  if (hrefAttr) return hrefAttr[1];
  return "";
}

export function parseFeed(xml) {
  const items = [];
  const itemBlocks =
    xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ||
    xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ||
    [];
  for (const block of itemBlocks) {
    const title = stripTags(tagContent(block, "title"));
    let link = extractLink(block);
    if (!link) {
      const guid = stripTags(tagContent(block, "guid"));
      if (/^https?:\/\//i.test(guid)) link = guid;
    }
    const pubDate = stripTags(tagContent(block, "pubDate") || tagContent(block, "updated") || tagContent(block, "published"));
    const rawDesc = tagContent(block, "description") || tagContent(block, "summary") || tagContent(block, "content");
    const description = stripTags(rawDesc);
    if (!title && !link) continue;
    items.push({ title, link, description, pubDate });
  }
  return { ok: items.length > 0, items };
}
