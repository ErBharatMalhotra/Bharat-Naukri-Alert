import { test, runAll, assert, tmpDir } from "./runner.js";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { validateEntry, deadlineSanity, contentHash } from "../lib/schema.js";
import { parseFeed, decodeEntities } from "../lib/rss.js";
import { parseDateFlexible, detectCategory, extractDeadlineText, heuristicEntry } from "../lib/extract.js";
import { readDB, writeDB, mergeIntoDB, readState, writeState } from "../lib/store.js";
import { mineLinks } from "../sources/scrapers/html-links.js";
import { buildDigest, handleCommand } from "../telegram/bot.js";

const FIXTURES = path.resolve("tests/fixtures");
const FUTURE = "2027-06-15";

function makeRaw(overrides = {}) {
  return {
    title: "New National Scholarship for Class 9 students announced",
    description: "The last date to apply is 15/09/2026. Family income below Rs 250000 eligible.",
    link: "https://pib.gov.in/PressReleasePage.aspx?PRID=1",
    ...overrides,
  };
}

test("schema: valid entry passes", () => {
  const e = {
    id: "x-1", title: "Test Scholarship", category: "scholarship",
    official_link: "https://gov.in/x", source: "nsp",
    first_seen: new Date().toISOString(), status: "open", deadline: FUTURE,
    deadline_source_count: 2,
  };
  const v = validateEntry(e);
  assert.equal(v.valid, true, v.errors?.join("; "));
});

test("schema: invalid entries rejected", () => {
  assert.equal(validateEntry({}).valid, false);
  const bad = { id: "y", title: "t", category: "rocket", official_link: "ftp://x", source: "s", first_seen: "x", status: "maybe" };
  const v = validateEntry(bad);
  assert.equal(v.valid, false);
  assert.ok(v.errors.length >= 3);
});

test("schema: deadline sanity catches past dates", () => {
  assert.equal(deadlineSanity({ deadline: "2001-01-01" }).ok, false);
  assert.equal(deadlineSanity({ deadline: FUTURE }).ok, true);
  assert.equal(deadlineSanity({}).ok, true);
});

test("schema: contentHash deterministic + distinct", () => {
  const a = contentHash({ title: "Scholarship A", org: "NSP", official_link: "https://a.gov.in" });
  const b = contentHash({ title: "Scholarship A", org: "NSP", official_link: "https://a.gov.in" });
  const c = contentHash({ title: "Scholarship B", org: "NSP", official_link: "https://a.gov.in" });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("rss: parses fixture feed with CDATA + entities", async () => {
  const xml = await fs.readFile(path.join(FIXTURES, "sample-feed.xml"), "utf8");
  const { ok, items } = parseFeed(xml);
  assert.equal(ok, true);
  assert.equal(items.length, 3);
  assert.equal(items[0].title, "Ministry of Education launches new scholarship for class 9 students");
  assert.ok(items[0].link.includes("PRID=123456"));
  assert.ok(items[0].description.includes("last date to apply is 15/09/2026"));
});

test("rss: decodeEntities handles numeric + named refs", () => {
  assert.equal(decodeEntities("A &amp; B &#39;C&#39; &#8377;100"), "A & B 'C' \u20b9100");
});

test("extract: parseDateFlexible handles Indian formats", () => {
  assert.equal(parseDateFlexible("apply by 15/09/2026"), "2026-09-15");
  assert.equal(parseDateFlexible("deadline 30-10-2026"), "2026-10-30");
  assert.equal(parseDateFlexible("September 20, 2026"), "2026-09-20");
  assert.equal(parseDateFlexible("20 September 2026"), "2026-09-20");
  assert.equal(parseDateFlexible("2026-12-01"), "2026-12-01");
  assert.equal(parseDateFlexible("no date here"), null);
});

test("extract: detectCategory maps keywords", () => {
  assert.equal(detectCategory("UGC scholarship notification"), "scholarship");
  assert.equal(detectCategory("SSC CGL recruitment examination"), "exam");
  assert.equal(detectCategory("PM Awas Yojana extended"), "scheme");
  assert.equal(detectCategory("Weather report"), null);
});

test("extract: deadline text mining works", () => {
  const d = extractDeadlineText("The last date to apply is 15/09/2026 for all candidates.");
  assert.equal(d, "2026-09-15");
  assert.equal(extractDeadlineText("nothing useful here"), null);
});

test("extract: heuristicEntry builds complete record", () => {
  const src = { id: "pib-rss", name: "PIB", url: "https://pib.gov.in/rss", default_category: "scheme" };
  const e = heuristicEntry(makeRaw(), src);
  assert.ok(e, "entry should not be null");
  assert.equal(e.category, "scholarship");
  assert.equal(e.deadline, "2026-09-15");
  assert.equal(e.id, e.content_hash);
  assert.ok(!/pib|rss|agg/i.test(e.id), "id should not leak source name");
  assert.ok(e.content_hash.length > 5);
  assert.equal(validateEntry(e).valid, true);
});

test("scrapers: mineLinks extracts keyword anchors only", async () => {
  const html = await fs.readFile(path.join(FIXTURES, "ssc-page.html"), "utf8");
  const raws = mineLinks(html, "https://ssc.nic.in", ["notification", "recruitment", "result"]);
  assert.equal(raws.length, 3);
  assert.ok(raws.every((r) => /^https:\/\/ssc\.nic\.in/.test(r.link)));
  assert.ok(raws.some((r) => r.title.includes("Combined Graduate Level")));
});

test("store: mergeIntoDB adds, updates and dedups", async () => {
  const dir = await tmpDir();
  const prev = process.cwd();
  process.chdir(dir);
  try {
    const src = { id: "nsp", name: "NSP", url: "https://scholarships.gov.in", default_category: "scholarship" };
    let db = await readDB();
    const e1 = heuristicEntry(makeRaw(), src);
    let rep = mergeIntoDB(db, [e1]);
    assert.equal(rep.added.length, 1);

    const changed = heuristicEntry(
      makeRaw({ description: "The last date to apply is 25/10/2026. Income limit applies." }),
      src
    );
    rep = mergeIntoDB(db, [changed]);
    assert.equal(rep.updated.length, 1);
    assert.ok(db.opportunities[0].history.length >= 1);

    rep = mergeIntoDB(db, [changed]);
    assert.equal(rep.duplicates, 1);
    assert.equal(db.opportunities.length, 1);

    await writeDB(db);
    const reloaded = await readDB();
    assert.equal(reloaded.opportunities.length, 1);

    await writeState({ tg_offset: 42 });
    assert.equal((await readState()).tg_offset, 42);
  } finally {
    process.chdir(prev);
  }
});

test("telegram: digest builder formats correctly", () => {
  const empty = buildDigest([], "2026-08-22");
  assert.ok(empty.includes("Digest"));
  const src = { id: "nsp", name: "NSP", url: "https://x.gov.in", default_category: "scholarship" };
  const e = heuristicEntry(makeRaw(), src);
  const full = buildDigest([e], "2026-08-22");
  assert.ok(full.includes(e.title));
  assert.ok(full.includes(e.deadline));
  assert.ok(full.includes("Verify on official portal"));
});

test("telegram: command handler responds", () => {
  const src = { id: "nsp", name: "NSP", url: "https://x.gov.in", default_category: "scholarship" };
  const e = heuristicEntry(makeRaw(), src);
  assert.match(handleCommand("/help", []), /Bharat Naukri Alert Bot/);
  assert.match(handleCommand("/search scholarship", [e]), /National Scholarship/);
  assert.match(handleCommand("/search zzzz-nothing", [e]), /nahi mila/);
  const r = handleCommand("/new", [e]);
  assert.equal(typeof r, "string");
  assert.ok(r.length > 0);
});

test("site: build generates complete static site", async () => {
  const dir = await tmpDir();
  const prev = process.cwd();
  process.chdir(dir);
  try {
    const src = { id: "nsp", name: "NSP", url: "https://x.gov.in", default_category: "scholarship" };
    const s2 = { id: "ssc", name: "SSC", url: "https://ssc.nic.in", default_category: "exam" };
    const a = heuristicEntry(makeRaw(), src);
    const b = heuristicEntry(
      makeRaw({
        title: "Combined Graduate Level Examination 2026 notification released",
        description: "Apply online before 30-10-2026 through SSC portal.",
        link: "https://ssc.nic.in/cgl26",
      }),
      s2
    );
    await fs.mkdir("data", { recursive: true });
    await fs.writeFile("data/opportunities.json", JSON.stringify({ version: 1, updated_at: null, opportunities: [a, b] }));

    const { buildSite } = await import("../site/build.js");
    const res = await buildSite();
    assert.ok(res.pages > 4);

    const idx = await fs.readFile("site/dist/index.html", "utf8");
    assert.ok(idx.includes("Bharat Naukri Alert"));
    assert.ok(idx.includes(a.id));

    const detail = await fs.readFile(`site/dist/o/${encodeURIComponent(a.id)}.html`, "utf8");
    assert.ok(detail.includes("Official Portal"));

    const cat = await fs.readFile("site/dist/category/scholarship.html", "utf8");
    assert.ok(cat.includes("../index.html"));

    const sitemap = await fs.readFile("site/dist/sitemap.xml", "utf8");
    assert.ok(sitemap.includes("<loc>"));
    const si = JSON.parse(await fs.readFile("site/dist/search-index.json", "utf8"));
    assert.equal(si.length, 2);
    await fs.access("site/dist/robots.txt");
    const idxHtml = await fs.readFile("site/dist/index.html", "utf8");
    assert.ok(!idxHtml.toLowerCase().includes("autonomous"), "no automation branding on homepage");
  } finally {
    process.chdir(prev);
  }
});

await runAll();
