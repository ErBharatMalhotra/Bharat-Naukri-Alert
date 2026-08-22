import { fetchText, politeDelay } from "../../lib/http.js";
import { mineLinks } from "./html-links.js";

export async function scrape(source) {
  const errors = [];
  let raws = [];
  try {
    const html = await fetchText(source.url);
    raws = mineLinks(html, source.url, source.keywords || ["form", "notification", "result", "admit card", "recruitment", "vacancy"]);
    await politeDelay(2000);
  } catch (err) {
    errors.push(`${source.url}: ${err.message}`);
  }
  return { raws: raws.slice(0, 60), errors };
}
