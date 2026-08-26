import { loadAllSources } from "../lib/runtime-config.js";
import { fetchText, fetchTextViaProxy } from "../lib/http.js";
import { mineLinks } from "../sources/scrapers/html-links.js";
import { parseFeed } from "../lib/rss.js";

// Standalone source probe — prints per-source match counts. DB ko touch nahi karta.
const all = await loadAllSources();
console.log(`probing ${all.length} enabled sources...\n`);

for (const src of all) {
  const label = `${src.id} (${src.type})`;
  try {
    if (src.type === "rss") {
      let items = 0;
      for (const u of src.urls || []) {
        const xml = await fetchText(u);
        items += parseFeed(xml).items.length;
      }
      console.log(`${label}: ${items} feed items`);
    } else {
      let html = null;
      let via = "direct";
      try {
        html = await fetchText(src.url, { retries: 0 });
      } catch {
        html = await fetchTextViaProxy(src.url);
        via = "PROXY";
      }
      const raws = mineLinks(html, src.url, src.keywords || ["notification", "recruitment"]);
      const strong = raws.filter((r) => (r.title || "").length >= (src.min_title_len || 8));
      console.log(`${label}: ${raws.length} links mined (${strong.length} pass min_title_len) [${via}]`);
      for (const r of strong.slice(0, 3)) console.log(`   e.g. ${r.title.slice(0, 80)}`);
    }
  } catch (err) {
    console.log(`${label}: FAILED — ${String(err.message).slice(0, 90)}`);
  }
}
