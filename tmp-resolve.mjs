import { fetchText } from "./lib/http.js";

const t = await fetchText("https://www.rojgarresult.com");
const anchors = [...t.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((x) => ({
  href: x[1],
  text: x[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
}));
const item = anchors.find((a) => /recruitment/i.test(a.text) && /form|apply/i.test(a.text));
console.log("sample item:", item?.text.slice(0, 70), "->", item?.href?.slice(0, 60));

if (item) {
  const detail = await fetchText(item.href);
  const links = [...detail.matchAll(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((x) => x[1]);
  const ext = [...new Set(links)].filter((l) => !/rojgarresult\.com/i.test(l));
  console.log("--- external links on detail page ---");
  ext.slice(0, 12).forEach((l) => console.log("   ", l.slice(0, 90)));
}
