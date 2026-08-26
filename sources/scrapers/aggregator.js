import { fetchText, fetchTextViaProxy, politeDelay } from "../../lib/http.js";
import { mineLinks } from "./html-links.js";

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
    raws = mineLinks(html, source.url, source.keywords || ["form", "notification", "result", "admit card", "recruitment", "vacancy"]);
    await politeDelay(2000);
  }
  return { raws: raws.slice(0, 60), errors };
}
