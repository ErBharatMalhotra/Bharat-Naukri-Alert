import { parseFeed } from "../../lib/rss.js";
import { fetchText, politeDelay } from "../../lib/http.js";

export async function scrape(source) {
  const raws = [];
  const errors = [];
  for (const url of source.urls) {
    try {
      const xml = await fetchText(url);
      const { ok, items } = parseFeed(xml);
      if (!ok) errors.push(`no items in ${url}`);
      for (const it of items) {
        raws.push({
          title: it.title,
          description: it.description,
          link: it.link || url,
          published: it.pubDate,
        });
      }
      await politeDelay(2000);
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }
  return { raws, errors };
}
