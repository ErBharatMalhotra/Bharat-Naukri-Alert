import fs from "node:fs/promises";
import path from "node:path";
import { readDB } from "../lib/store.js";

const DIST = () => path.join(process.cwd(), "site", "dist");
const SITE_URL = process.env.SITE_URL || "https://bharat-naukri-alert.pages.dev";

const CAT_LABELS = {
  scholarship: { en: "Scholarships", hi: "छात्रवृत्तियाँ" },
  exam: { en: "Exams", hi: "परीक्षाएँ" },
  job: { en: "Jobs", hi: "नौकरियाँ" },
  scheme: { en: "Schemes", hi: "योजनाएँ" },
  "admit-card": { en: "Admit Cards", hi: "एडमिट कार्ड" },
  result: { en: "Results", hi: "परिणाम" },
};

function esc(s = "") {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = `
:root{--bg:#0f1420;--card:#1a2233;--ink:#e8ecf4;--mut:#93a0b8;--acc:#f5b301;--line:#26314a}
*{box-sizing:border-box;margin:0}
body{font-family:system-ui,'Segoe UI','Noto Sans Devanagari',sans-serif;background:var(--bg);color:var(--ink);line-height:1.6}
.wrap{max-width:960px;margin:0 auto;padding:16px}
header{border-bottom:1px solid var(--line)}
a{color:inherit}
.logo{display:inline-block;font-weight:800;font-size:20px;color:var(--acc);text-decoration:none;padding-top:12px}
.logo span{color:var(--ink)}
nav{display:flex;gap:12px;flex-wrap:wrap;padding:10px 0;font-size:14px}
nav a{color:var(--mut);text-decoration:none}
nav a:hover{color:var(--ink)}
.hero{padding:36px 0 8px}
h1{font-size:clamp(24px,4vw,34px)}
.sub{color:var(--mut);margin-top:6px}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 16px;text-align:center;min-width:110px}
.stat b{display:block;font-size:22px;color:var(--acc)}
.stat small{color:var(--mut)}
#q{width:100%;padding:13px 16px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:16px;margin:8px 0 4px}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px}
.chip{cursor:pointer;padding:6px 13px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);font-size:13px;text-decoration:none}
.chip.on{background:var(--acc);color:#111;border-color:var(--acc);font-weight:700}
.card{display:block;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--acc);border-radius:10px;padding:14px 16px;margin:10px 0;text-decoration:none;color:var(--ink)}
.card:hover{border-color:var(--acc)}
.card h3{font-size:16px;margin-bottom:4px}
.meta{color:var(--mut);font-size:13px;display:flex;gap:10px;flex-wrap:wrap}
.badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--mut)}
.badge.closing{color:#ffb4a2;border-color:#ff7043}
.disc{margin-top:28px;padding:12px;background:#241d10;border:1px dashed #6b561e;border-radius:10px;color:#d9c07a;font-size:13px}
footer{margin-top:30px;padding:18px 0;color:var(--mut);font-size:13px;border-top:1px solid var(--line)}
footer a{color:var(--mut)}
.empty{color:var(--mut);padding:30px 0;text-align:center}
`;

function layout({ title, desc, canonical, body, jsonld }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<script type="application/ld+json">${jsonld || "{}"}</script>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function nav(prefix = "") {
  const cats = Object.entries(CAT_LABELS)
    .map(([k, v]) => `<a href="${prefix}category/${k}.html">${v.en}</a>`)
    .join("");
  return `<div class="wrap"><a class="logo" href="${prefix}index.html">Bharat<span> Naukri Alert</span></a><nav><a href="${prefix}index.html">Home</a>${cats}</nav></div>`;
}

function cardHTML(e, rel = "") {
  const badgeCls = e.status === "closing_soon" ? "badge closing" : "";
  return `<a class="card" data-cat="${e.category}" href="${rel}o/${encodeURIComponent(e.id)}.html">
<h3>${esc(e.title)}</h3>
<div class="meta"><span>${esc(e.org)}</span>
${e.deadline ? `<span>Last date: <b>${e.deadline}</b></span>` : ""}
<span class="badge ${badgeCls}">${e.status.replace("_", " ")}</span>
<span class="badge">${CAT_LABELS[e.category]?.en || e.category}</span></div></a>`;
}

function disclaimer() {
  return `<div class="disc">&#9888;&#65039; Disclaimer: Yeh ek third-party information service hai. Apply karne se pehle official portal par details zaroor verify karein.</div>`;
}

function detailBody(e) {
  return `<header>${nav("../")}</header>
<div class="wrap">
<div class="hero"><h1>${esc(e.title)}</h1>
<p class="sub">${esc(e.org)} &nbsp;|&nbsp; <span class="badge ${e.status === "closing_soon" ? "closing" : ""}">${e.status.replace("_", " ")}</span></p></div>
<div class="stats">
${e.deadline ? `<div class="stat"><b>${e.deadline}</b><small>Last date to apply</small></div>` : ""}
${e.amount ? `<div class="stat"><b>${esc(e.amount)}</b><small>Benefit / Pay</small></div>` : ""}
<div class="stat"><b>${esc(CAT_LABELS[e.category]?.hi || e.category)}</b><small>Category</small></div>
</div>
${e.summary ? `<p>${esc(e.summary)}</p>` : ""}
${e.eligibility?.education?.length ? `<p><b>Education:</b> ${esc(e.eligibility.education.join(", "))}</p>` : ""}
<p style="margin-top:18px"><a class="chip on" href="${esc(e.official_link)}" rel="nofollow noopener" target="_blank">Official Portal &#8599;</a></p>
${disclaimer()}
<footer>Data archived since ${e.first_seen?.slice(0, 10) || "today"} &middot; Powered by an autonomous agent</footer>
</div>`;
}

async function writeFile(relPath, content) {
  const file = path.join(DIST(), relPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

export async function buildSite() {
  const db = await readDB();
  const entries = db.opportunities.filter((o) => o.status !== "closed");
  await fs.rm(DIST(), { recursive: true, force: true });
  await fs.mkdir(DIST(), { recursive: true });

  const closing = entries
    .filter((e) => e.deadline && e.status === "closing_soon")
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const latest = [...entries]
    .sort((a, b) => (b.first_seen || "").localeCompare(a.first_seen || ""))
    .slice(0, 50);

  const stats = { total: db.opportunities.length, open: entries.length, closing: closing.length };

  const idxBody = `<header>${nav("")}</header><div class="wrap">
<section class="hero"><h1>Naukri · Scholarship · Exam · Yojana — sab ek jagah.</h1>
<p class="sub">Scholarships, exams, jobs aur schemes — rozana automatically update hota hai. Free forever.</p></section>
<div class="stats">
<div class="stat"><b id="st-total">${stats.total}</b><small>Total tracked</small></div>
<div class="stat"><b id="st-open">${stats.open}</b><small>Active now</small></div>
<div class="stat"><b>${stats.closing}</b><small>Closing soon</small></div>
</div>
<input id="q" type="search" placeholder="Search: scholarship, UPSC, yojana..." autocomplete="off">
<div class="filters" id="filters">
<button class="chip on" data-f="all">All</button>
${Object.entries(CAT_LABELS).map(([k, v]) => `<button class="chip" data-f="${k}">${v.en}</button>`).join("")}
</div>
<div id="list">${latest.map((e) => cardHTML(e)).join("")}</div>
<div class="empty" id="empty" hidden>Kuch nahi mila. Doosre keywords try karo.</div>
${disclaimer()}
<footer>Autonomous engine &middot; Updated ${new Date().toISOString().slice(0, 10)} &middot; <a href="sitemap.xml">Sitemap</a></footer>
</div>
<script>
const IDX=fetch('search-index.json').then(r=>r.json());
let F='all';
document.getElementById('filters').addEventListener('click',ev=>{const b=ev.target.closest('.chip');if(!b)return;
document.querySelectorAll('#filters .chip').forEach(c=>c.classList.remove('on'));b.classList.add('on');F=b.dataset.f;render();});
document.getElementById('q').addEventListener('input',render);
function render(){IDX.then(idx=>{const q=document.getElementById('q').value.toLowerCase().trim();
const out=idx.filter(e=>(F==='all'||e.c===F)&&(!q||(e.t+' '+e.o+' '+e.s).toLowerCase().includes(q)));
document.getElementById('list').innerHTML=out.slice(0,60).map(e=>e.h).join('');
document.getElementById('empty').hidden=out.length>0;
document.getElementById('st-open').textContent=idx.length;});}
render();
</script>`;

  const homeJSONLD = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bharat Naukri Alert",
    description: "Autonomous tracker of Indian government scholarships, exams, jobs and schemes",
    url: SITE_URL,
  });

  await writeFile("index.html", layout({
    title: "Bharat Naukri Alert — Sarkari Scholarships, Exams, Jobs & Schemes Tracker",
    desc: "Every Indian government opportunity in one place. Auto-updated daily: scholarships, exams, jobs, schemes with deadlines.",
    canonical: `${SITE_URL}/`,
    body: idxBody,
    jsonld: homeJSONLD,
  }));

  for (const [cat, labels] of Object.entries(CAT_LABELS)) {
    const list = entries.filter((e) => e.category === cat);
    await writeFile(`category/${cat}.html`, layout({
      title: `${labels.en} — Bharat Naukri Alert`,
      desc: `Latest government ${labels.en.toLowerCase()} with deadlines, auto-updated.`,
      canonical: `${SITE_URL}/category/${cat}.html`,
      body: `<header>${nav("../")}</header><div class="wrap"><h1 style="margin-top:20px">${labels.en} <span style="color:var(--mut);font-size:15px">(${list.length})</span></h1>
${list.map((e) => cardHTML(e, "../")).join("") || '<p class="empty">Abhi kuch nahi. Jald update hoga.</p>'}
<footer>&#8592; <a href="../index.html">Home</a></footer></div>`,
    }));
  }

  for (const e of entries) {
    await writeFile(`o/${encodeURIComponent(e.id)}.html`, layout({
      title: `${e.title.slice(0, 60)} — Last date ${e.deadline || "check portal"} | Bharat Naukri Alert`,
      desc: (e.summary || `${e.title} by ${e.org}. Check deadline and apply.`).slice(0, 155),
      canonical: `${SITE_URL}/o/${encodeURIComponent(e.id)}.html`,
      body: detailBody(e),
      jsonld: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: e.title,
        description: e.summary || e.title,
        url: `${SITE_URL}/o/${encodeURIComponent(e.id)}.html`,
        keywords: [e.category, e.org, "government"],
      }),
    }));
  }

  const searchIndex = entries.map((e) => ({
    t: e.title,
    o: e.org,
    c: e.category,
    d: e.deadline,
    s: (e.summary || "").slice(0, 140),
    h: cardHTML(e),
  }));
  await writeFile("search-index.json", JSON.stringify(searchIndex));

  const urls = ["", ...Object.keys(CAT_LABELS).map((c) => `category/${c}.html`), ...entries.map((e) => `o/${encodeURIComponent(e.id)}.html`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `\t<url><loc>${SITE_URL}/${u}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`).join("\n")}
</urlset>`;
  await writeFile("sitemap.xml", sitemap);

  await writeFile("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml`);
  await writeFile("llms.txt", `# Bharat Naukri Alert\n\nAutonomous tracker of Indian government opportunities: scholarships, exams, jobs, schemes.\nStructured JSON data available in the source repository under data/.\n`);

  return { pages: urls.length + 1, entries: entries.length, stats };
}

if (process.argv[1] && process.argv[1].endsWith("build.js")) {
  console.log(JSON.stringify(await buildSite(), null, 2));
}
