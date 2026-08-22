import { fetchText } from "./lib/http.js";
const portals = [
  ["sarkariresult", "https://www.sarkariresult.com"],
  ["freejobalert", "https://www.freejobalert.com"],
  ["rojgarresult", "https://www.rojgarresult.com"],
  ["sarkariexam", "https://www.sarkariexam.com"],
  ["jobriya", "https://www.jobriya.in"],
  ["sarkarijobfind", "https://www.sarkarijobfind.com"],
  ["sarkariujala", "https://sarkariujala.net"],
];
for (const [n, u] of portals) {
  try {
    const t = await fetchText(u);
    const anchors = [...t.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(
      (x) => x[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    ).filter((a) => a.length > 15 && a.length < 130);
    const formish = anchors.filter((a) => /form|notification|result|admit|vacancy|recruit|answer key|syllabus/i.test(a));
    console.log("==", n.padEnd(15), "| anchors:", String(anchors.length).padStart(3), "| opportunity-ish:", String(formish.length).padStart(3));
    [...new Set(formish)].slice(0, 4).forEach((x) => console.log("     ", x.slice(0, 85)));
  } catch (e) {
    console.log("==", n.padEnd(15), "| FAIL |", String(e.message).slice(0, 50));
  }
}
